import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Expense } from './expense.entity';

export enum ReminderChannel {
  INAPP = 'INAPP',
  WHATSAPP = 'WHATSAPP',
}

export enum ReminderStatus {
  SENT = 'SENT',
  FAILED = 'FAILED',
}

/**
 * Log de cada lembrete enviado para uma despesa.
 * O índice único (expenseId, daysBefore, channel) garante idempotência:
 * o cron não envia o mesmo lembrete duas vezes no mesmo dia.
 */
@Entity('expense_reminders')
@Index(['expenseId', 'daysBefore', 'channel'], { unique: true })
export class ExpenseReminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  expenseId!: string;

  @ManyToOne(() => Expense, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'expenseId' })
  expense?: Expense;

  /** Quantos dias antes do vencimento este lembrete representa (3, 7, 15...). */
  @Column({ type: 'integer' })
  daysBefore!: number;

  @Column({ type: 'enum', enum: ReminderChannel })
  channel!: ReminderChannel;

  @Column({ type: 'enum', enum: ReminderStatus })
  status!: ReminderStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  sentAt!: Date;
}