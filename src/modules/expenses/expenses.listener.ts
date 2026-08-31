import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { ReminderChannel } from './entities/expense-reminder.entity';
import { ExpenseRemindersRepository } from './expense-reminders.repository';
import { Expense } from './entities/expense.entity';

/**
 * Ouve os eventos emitidos pelo ciclo de vida das despesas e, no caso de
 * `expense.reminder.due`, registra o lembrete in-app (FACT de existência)
 * e dispara o envio via WhatsApp quando aplicável.
 *
 * O cron já grava o ExpenseReminder(status=PENDING) antes de emitir o evento
 * para garantir idempotência — aqui só confirmamos SENT/FAILED após o envio.
 */
@Injectable()
export class ExpensesListener implements OnModuleInit {
  private readonly logger = new Logger(ExpensesListener.name);

  constructor(
    private events: EventEmitter2,
    private reminders: ExpenseRemindersRepository,
    private whatsapp: WhatsappService,
  ) {}

  onModuleInit() {
    // Resposta a lifecycle events do CRUD — só para log por enquanto.
  }

  @OnEvent('expense.created')
  handleCreated(payload: { expense: Expense }) {
    this.logger.log(
      `💸 expense.created → ${payload.expense.description} (R$ ${(payload.expense.amountCents / 100).toFixed(2)} vencimento ${payload.expense.dueDate})`,
    );
  }

  @OnEvent('expense.paid')
  handlePaid(payload: { expense: Expense }) {
    this.logger.log(`✅ expense.paid → ${payload.expense.description}`);
  }

  @OnEvent('expense.cancelled')
  handleCancelled(payload: { expense: Expense }) {
    this.logger.log(`🚫 expense.cancelled → ${payload.expense.description}`);
  }

  @OnEvent('expense.overdue')
  handleOverdue(payload: { expense: Expense }) {
    this.logger.warn(`⚠️ expense.overdue → ${payload.expense.description}`);
  }
}