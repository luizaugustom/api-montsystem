import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { RecurringExpensesRepository } from './recurring-expenses.repository';
import { ExpensesRepository } from './expenses.repository';
import {
  RecurringExpense,
  RecurrenceFrequency,
  PaymentMethod,
} from './entities/recurring-expense.entity';
import { Expense, ExpenseStatus } from './entities/expense.entity';

/**
 * Gerencia templates de despesas recorrentes.
 *
 * Para cada template ativo, calcula a próxima `dueDate` baseado na frequência
 * e gera uma `Expense` se ainda não existir para aquela data (idempotente).
 *
 * Casos especiais:
 *  - MONTHLY com dayOfMonth > último dia do mês → usa o último dia (ex: dia 31 em fevereiro → 28/29).
 *  - WEEKLY: pega o próximo dia da semana >= hoje.
 *  - YEARLY: usa monthDay "MM-DD"; se já passou no ano corrente, vai para o próximo ano.
 *  - Se `endDate` definida e hoje > endDate, não gera mais.
 */
@Injectable()
export class RecurringExpensesService {
  private readonly logger = new Logger(RecurringExpensesService.name);

  constructor(
    private repo: RecurringExpensesRepository,
    private expenses: ExpensesRepository,
    private events: EventEmitter2,
  ) {}

  findAll() {
    return this.repo.findAll();
  }

  async findOne(id: string) {
    const r = await this.repo.findOne(id);
    if (!r) throw new NotFoundException('Recorrência não encontrada');
    return r;
  }

  create(data: Partial<RecurringExpense>) {
    this.validate(data);
    return this.repo.create(data);
  }

  async update(id: string, patch: Partial<RecurringExpense>) {
    await this.findOne(id);
    this.validate({ ...patch });
    return this.repo.update(id, patch);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.repo.remove(id);
  }

  /**
   * Gera despesas para todos os templates ativos cuja próxima data já chegou
   * e ainda não foi gerada. Idempotente via lastGeneratedDate + findByRecurringAndDueDate.
   */
  async generate(opts: { referenceDate?: string } = {}): Promise<{ created: number; skipped: number }> {
    const today = opts.referenceDate || dayjs().format('YYYY-MM-DD');
    const actives = await this.repo.findActive();

    let created = 0;
    let skipped = 0;

    for (const template of actives) {
      // Janela de validade
      if (template.endDate && dayjs(today).isAfter(dayjs(template.endDate), 'day')) {
        skipped++;
        continue;
      }
      if (dayjs(today).isBefore(dayjs(template.startDate), 'day')) {
        skipped++;
        continue;
      }

      const dueDate = this.computeNextDueDate(template, today);
      if (!dueDate) {
        skipped++;
        continue;
      }

      // Não gera se a próxima data já passou E o template não permite "backfill"
      if (dayjs(dueDate).isBefore(dayjs(today), 'day')) {
        skipped++;
        continue;
      }

      // Idempotência: já existe despesa para (template, dueDate)?
      const existing = await this.expenses.findByRecurringAndDueDate(template.id, dueDate);
      if (existing) {
        skipped++;
        continue;
      }

      const expense = await this.expenses.create({
        description: template.description,
        categoryId: template.categoryId,
        amountCents: template.amountCents,
        dueDate,
        status: ExpenseStatus.PENDING,
        paymentMethod: template.paymentMethod ?? undefined,
        supplier: template.supplier ?? undefined,
        notes: template.notes ?? undefined,
        attachments: template.attachments ?? undefined,
        recurringExpenseId: template.id,
      });

      await this.repo.update(template.id, { lastGeneratedDate: dueDate });
      this.events.emit('expense.created', { expense, template });
      created++;
    }

    this.logger.log(
      `Recorrências geradas: ${created} criadas, ${skipped} puladas (ref ${today})`,
    );
    return { created, skipped };
  }

  /**
   * Gera manualmente a próxima instância de um único template.
   * Endpoint útil para testes e para "forçar" geração após criar o template.
   */
  async generateOne(id: string) {
    const template = await this.findOne(id);
    if (!template.active) throw new BadRequestException('Template inativo');

    const today = dayjs().format('YYYY-MM-DD');
    const dueDate = this.computeNextDueDate(template, today);
    if (!dueDate) throw new BadRequestException('Não foi possível calcular a próxima data');

    const existing = await this.expenses.findByRecurringAndDueDate(template.id, dueDate);
    if (existing) return existing;

    const expense = await this.expenses.create({
      description: template.description,
      categoryId: template.categoryId,
      amountCents: template.amountCents,
      dueDate,
      status: ExpenseStatus.PENDING,
      paymentMethod: template.paymentMethod ?? undefined,
      supplier: template.supplier ?? undefined,
      notes: template.notes ?? undefined,
      attachments: template.attachments ?? undefined,
      recurringExpenseId: template.id,
    });

    await this.repo.update(template.id, { lastGeneratedDate: dueDate });
    this.events.emit('expense.created', { expense, template });
    return expense;
  }

  // ────────────────────────────────────────────────────────────────────
  // Cálculo da próxima data por frequência
  // ────────────────────────────────────────────────────────────────────

  computeNextDueDate(template: RecurringExpense, today: string): string | null {
    switch (template.frequency) {
      case RecurrenceFrequency.MONTHLY:
        return this.nextMonthly(template, today);
      case RecurrenceFrequency.WEEKLY:
        return this.nextWeekly(template, today);
      case RecurrenceFrequency.YEARLY:
        return this.nextYearly(template, today);
      default:
        return null;
    }
  }

  /**
   * Para MONTHLY: pega o próximo mês cuja data-alvo (limitada ao último dia)
   * seja >= hoje. Se o mês corrente já tem a data futura, usa esse mês.
   * Se a data-alvo deste mês já passou, vai para o próximo mês.
   */
  private nextMonthly(template: RecurringExpense, today: string): string {
    const target = template.dayOfMonth;
    const todayDate = dayjs(today);

    // Tenta o mês corrente
    const candidate = this.clampDayOfMonth(todayDate.year(), todayDate.month(), target);
    if (!dayjs(candidate).isBefore(dayjs(today), 'day')) return candidate;

    // Senão, próximo mês
    const nextMonth = todayDate.add(1, 'month');
    return this.clampDayOfMonth(nextMonth.year(), nextMonth.month(), target);
  }

  /** Limita o dia ao último dia do mês (ex: 31 em fev → 28/29). */
  private clampDayOfMonth(year: number, monthIdx: number, day: number): string {
    const lastDay = dayjs(`${year}-${String(monthIdx + 1).padStart(2, '0')}-01`).endOf('month').date();
    const finalDay = Math.min(day, lastDay);
    return dayjs(`${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`).format('YYYY-MM-DD');
  }

  /** Para WEEKLY: pega o próximo dia da semana >= hoje. */
  private nextWeekly(template: RecurringExpense, today: string): string {
    const target = template.dayOfWeek ?? 0;
    const todayDate = dayjs(today);
    const diff = (target - todayDate.day() + 7) % 7;
    return todayDate.add(diff, 'day').format('YYYY-MM-DD');
  }

  /** Para YEARLY: usa monthDay "MM-DD". Se já passou no ano corrente, vai para o próximo ano. */
  private nextYearly(template: RecurringExpense, today: string): string {
    if (!template.monthDay) return today;
    const [mm, dd] = template.monthDay.split('-').map((v) => Number(v));
    if (!mm || !dd) return today;
    const todayDate = dayjs(today);
    const candidate = dayjs(`${todayDate.year()}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
    if (!candidate.isBefore(dayjs(today), 'day')) return candidate.format('YYYY-MM-DD');
    return candidate.add(1, 'year').format('YYYY-MM-DD');
  }

  private validate(data: Partial<RecurringExpense>) {
    if (!data.frequency) return;
    if (data.frequency === RecurrenceFrequency.WEEKLY && data.dayOfWeek == null) {
      throw new BadRequestException('dayOfWeek é obrigatório para frequência WEEKLY');
    }
    if (data.frequency === RecurrenceFrequency.YEARLY && !data.monthDay) {
      throw new BadRequestException('monthDay (MM-DD) é obrigatório para frequência YEARLY');
    }
    if (data.reminderDaysBefore && data.reminderDaysBefore.some((d) => d < 0 || d > 60)) {
      throw new BadRequestException('reminderDaysBefore deve estar entre 0 e 60 dias');
    }
  }
}