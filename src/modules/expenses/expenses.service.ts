import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { ExpensesRepository, FindAllOpts } from './expenses.repository';
import {
  Expense,
  ExpenseStatus,
} from './entities/expense.entity';
import { PaymentMethod } from './entities/recurring-expense.entity';

/**
 * CRUD + fluxo de status das despesas.
 * Mantém o foco em "contas a pagar" — pagamento/cancelamento atualiza status
 * e emite evento para que listeners (WhatsApp/email) possam reagir.
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private repo: ExpensesRepository,
    private events: EventEmitter2,
  ) {}

  // ───────── CRUD ─────────

  async create(data: Partial<Expense> & { amount?: number | string }) {
    const payload = this.normalizeAmount(data);
    this.validate(payload);
    const created = await this.repo.create(payload);
    this.events.emit('expense.created', { expense: created });
    return created;
  }

  async update(id: string, patch: Partial<Expense> & { amount?: number | string }) {
    await this.findOne(id);
    const payload = this.normalizeAmount(patch);
    this.validate({ ...payload, status: payload.status ?? ExpenseStatus.PENDING });
    return this.repo.update(id, payload);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.repo.remove(id);
  }

  async findOne(id: string) {
    const e = await this.repo.findOne(id);
    if (!e) throw new NotFoundException('Despesa não encontrada');
    return e;
  }

  findAll(opts: FindAllOpts = {}) {
    return this.repo.findAll(opts);
  }

  // ───────── Ações de status ─────────

  async markAsPaid(id: string, paidDate?: string): Promise<Expense> {
    const e = await this.findOne(id);
    if (e.status === ExpenseStatus.PAID) return e;
    if (e.status === ExpenseStatus.CANCELLED) {
      throw new BadRequestException('Despesa cancelada não pode ser marcada como paga');
    }
    e.status = ExpenseStatus.PAID;
    e.paidDate = paidDate || dayjs().format('YYYY-MM-DD');
    const saved = await this.repo.save(e);
    this.events.emit('expense.paid', { expense: saved });
    return saved;
  }

  async cancel(id: string): Promise<Expense> {
    const e = await this.findOne(id);
    e.status = ExpenseStatus.CANCELLED;
    const saved = await this.repo.save(e);
    this.events.emit('expense.cancelled', { expense: saved });
    return saved;
  }

  // ───────── Consultas para UI ─────────

  /** Despesas com vencimento entre hoje e hoje+days, ainda PENDING/OVERDUE. */
  findUpcoming(days = 7) {
    const from = dayjs().format('YYYY-MM-DD');
    const to = dayjs().add(days, 'day').format('YYYY-MM-DD');
    return this.repo.findUpcoming(from, to);
  }

  findOverdue() {
    const today = dayjs().format('YYYY-MM-DD');
    return this.repo.findOverdue(today);
  }

  /**
   * KPIs agregados para a tela /despesas.
   * Tudo no mesmo mês corrente + total atrasado + total próximos 7 dias.
   */
  async dashboard() {
    const all = await this.repo.findAll({ limit: 1000 });
    const today = dayjs().format('YYYY-MM-DD');
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
    const monthEnd = dayjs().endOf('month').format('YYYY-MM-DD');
    const next7 = dayjs().add(7, 'day').format('YYYY-MM-DD');

    let paidThisMonth = 0;
    let pendingThisMonth = 0;
    let overdue = 0;
    let upcoming7Days = 0;

    for (const e of all) {
      const amount = e.amountCents || 0;
      const isThisMonth = e.dueDate >= monthStart && e.dueDate <= monthEnd;
      if (e.status === ExpenseStatus.PAID && e.paidDate && e.paidDate >= monthStart && e.paidDate <= monthEnd) {
        paidThisMonth += amount;
      } else if (isThisMonth && (e.status === ExpenseStatus.PENDING || e.status === ExpenseStatus.OVERDUE)) {
        pendingThisMonth += amount;
      }
      if (e.status === ExpenseStatus.OVERDUE || (e.status === ExpenseStatus.PENDING && e.dueDate < today)) {
        overdue += amount;
      }
      if (
        (e.status === ExpenseStatus.PENDING || e.status === ExpenseStatus.OVERDUE) &&
        e.dueDate >= today &&
        e.dueDate <= next7
      ) {
        upcoming7Days += amount;
      }
    }

    return {
      paidThisMonthCents: paidThisMonth,
      pendingThisMonthCents: pendingThisMonth,
      overdueCents: overdue,
      upcoming7DaysCents: upcoming7Days,
    };
  }

  /** Chamado pelo cron para virar PENDING → OVERDUE quando vence. */
  async markOverdueBatch(): Promise<number> {
    const today = dayjs().format('YYYY-MM-DD');
    const overdue = await this.repo.findOverdue(today);
    let n = 0;
    for (const e of overdue) {
      e.status = ExpenseStatus.OVERDUE;
      await this.repo.save(e);
      this.events.emit('expense.overdue', { expense: e });
      n++;
    }
    if (n > 0) this.logger.log(`Marcadas ${n} despesas como OVERDUE`);
    return n;
  }

  // ───────── Helpers ─────────

  /**
   * Aceita `amount` em reais (string "1.234,56" ou number) e converte para cents.
   * Mantém compatibilidade com o pattern de `parseCurrency` usado nos outros
   * módulos (controllers já passam `amount` em vez de `amountCents`).
   */
  private normalizeAmount(data: any): any {
    if (data.amount == null) return data;
    let cents: number;
    if (typeof data.amount === 'string') {
      const cleaned = data.amount.replace(/\./g, '').replace(',', '.');
      cents = Math.round(parseFloat(cleaned) * 100);
    } else {
      cents = Math.round(Number(data.amount) * 100);
    }
    const { amount: _omit, ...rest } = data;
    return { ...rest, amountCents: cents };
  }

  private validate(data: Partial<Expense>) {
    if (!data.description) throw new BadRequestException('Descrição é obrigatória');
    if (!data.categoryId) throw new BadRequestException('Categoria é obrigatória');
    if (data.amountCents == null || data.amountCents <= 0) {
      throw new BadRequestException('Valor deve ser maior que zero');
    }
    if (!data.dueDate) throw new BadRequestException('Vencimento é obrigatório');
  }
}