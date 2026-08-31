import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { RecurringExpensesService } from './recurring-expenses.service';
import { ExpensesService } from './expenses.service';
import { ExpensesRepository } from './expenses.repository';
import { RecurringExpensesRepository } from './recurring-expenses.repository';
import { ExpenseRemindersRepository } from './expense-reminders.repository';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CompanyService } from '../company/company.service';
import {
  ReminderChannel,
  ReminderStatus,
} from './entities/expense-reminder.entity';
import { ExpenseStatus } from './entities/expense.entity';

/**
 * Cron diário do módulo de despesas.
 *
 * Roda às 06:10 (offset do `monthly-charge-daily` em 06:07) e faz, em ordem:
 *  1. Marca despesas vencidas como OVERDUE.
 *  2. Gera instâncias a partir de templates recorrentes ativos.
 *  3. Para cada despesa pendente, verifica se hoje coincide com algum
 *     `reminderDaysBefore` configurado no template de origem. Se sim e ainda
 *     não existir ExpenseReminder para esse (expense, daysBefore, channel),
 *     registra como INAPP e dispara WhatsApp.
 *
 * Idempotência garantida pelo UNIQUE INDEX em `expense_reminders`.
 */
@Injectable()
export class ExpensesCron {
  private readonly logger = new Logger(ExpensesCron.name);

  constructor(
    private expensesService: ExpensesService,
    private expensesRepo: ExpensesRepository,
    private recurringService: RecurringExpensesService,
    private recurringRepo: RecurringExpensesRepository,
    private remindersRepo: ExpenseRemindersRepository,
    private whatsapp: WhatsappService,
    private company: CompanyService,
    private events: EventEmitter2,
  ) {}

  @Cron('10 6 * * *', { name: 'expenses-daily' })
  async daily() {
    this.logger.log('⏰ expenses-daily: iniciando');
    try {
      // 1. Marca overdue
      await this.expensesService.markOverdueBatch();

      // 2. Gera despesas recorrentes
      const r = await this.recurringService.generate();
      this.logger.log(`⏰ expenses-daily: recorrências → criadas ${r.created}, puladas ${r.skipped}`);

      // 3. Processa lembretes
      await this.dispatchReminders();
    } catch (e: any) {
      this.logger.error(`expenses-daily falhou: ${e?.message}`);
    }
  }

  /**
   * Para cada despesa PENDING/OVERDUE cujo template tem reminderDaysBefore,
   * verifica se hoje == dueDate - daysBefore. Se sim, dispara lembrete.
   *
   * Despachado em método público para que testes / smoke possam dispará-lo
   * sob demanda via `POST /expenses/cron/run-reminders` (debug).
   */
  async dispatchReminders(): Promise<number> {
    const today = dayjs().format('YYYY-MM-DD');
    const all = await this.expensesRepo.findAll({ limit: 1000 });
    let dispatched = 0;

    for (const expense of all) {
      if (expense.status !== ExpenseStatus.PENDING && expense.status !== ExpenseStatus.OVERDUE) continue;
      if (!expense.recurringExpenseId) continue;
      const template = await this.recurringRepo.findOne(expense.recurringExpenseId);
      if (!template) continue;
      const daysBefore = template.reminderDaysBefore || [];
      if (!daysBefore.length) continue;

      const daysUntilDue = dayjs(expense.dueDate).diff(dayjs(today), 'day');
      if (!daysBefore.includes(daysUntilDue)) continue;

      // Lembretes in-app (sempre grava a linha no log de reminders)
      if (!(await this.remindersRepo.existsFor(expense.id, daysUntilDue, ReminderChannel.INAPP))) {
        await this.remindersRepo.create({
          expenseId: expense.id,
          daysBefore: daysUntilDue,
          channel: ReminderChannel.INAPP,
          status: ReminderStatus.SENT,
        });
        dispatched++;
        this.events.emit('expense.reminder.due', { expense, daysBefore: daysUntilDue, channel: 'INAPP' });
      }

      // WhatsApp: tenta enviar. Usa o telefone da empresa configurada.
      if (!(await this.remindersRepo.existsFor(expense.id, daysUntilDue, ReminderChannel.WHATSAPP))) {
        await this.dispatchWhatsApp(expense, daysUntilDue);
        dispatched++;
      }
    }

    if (dispatched > 0) this.logger.log(`📨 expenses-daily: ${dispatched} lembrete(s) despachado(s)`);
    return dispatched;
  }

  private async dispatchWhatsApp(expense: any, daysBefore: number): Promise<void> {
    try {
      const cfg = this.company.get() || ({} as any);
      const phone = cfg?.company?.contact?.phone;
      if (!phone) {
        await this.remindersRepo.create({
          expenseId: expense.id,
          daysBefore,
          channel: ReminderChannel.WHATSAPP,
          status: ReminderStatus.FAILED,
          errorMessage: 'Telefone da empresa não configurado',
        });
        this.logger.warn(`WhatsApp despesa ${expense.id} falhou: telefone da empresa ausente`);
        return;
      }

      const valorReais = (expense.amountCents / 100).toFixed(2).replace('.', ',');
      const vencimentoBR = dayjs(expense.dueDate).format('DD/MM/YYYY');
      const categoria = expense.category?.name || '—';

      await this.whatsapp.sendTemplate({
        phone,
        templateKey: 'despesa_vencimento',
        variables: {
          descricao: expense.description,
          fornecedor: expense.supplier || '—',
          valor: valorReais,
          vencimento: vencimentoBR,
          categoria,
          dias_restantes: String(daysBefore),
        },
        monthlyChargeId: undefined as any, // não é mensalidade; será ignorado pelo whatsapp
      });

      await this.remindersRepo.create({
        expenseId: expense.id,
        daysBefore,
        channel: ReminderChannel.WHATSAPP,
        status: ReminderStatus.SENT,
      });
    } catch (e: any) {
      await this.remindersRepo.create({
        expenseId: expense.id,
        daysBefore,
        channel: ReminderChannel.WHATSAPP,
        status: ReminderStatus.FAILED,
        errorMessage: e?.message || 'erro desconhecido',
      });
      this.logger.warn(`WhatsApp despesa ${expense.id} falhou: ${e?.message}`);
    }
  }
}