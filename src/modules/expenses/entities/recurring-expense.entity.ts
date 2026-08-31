import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';

export enum RecurrenceFrequency {
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
  YEARLY = 'YEARLY',
}

export enum PaymentMethod {
  BOLETO = 'BOLETO',
  PIX = 'PIX',
  CARTAO = 'CARTAO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  DINHEIRO = 'DINHEIRO',
  OUTRO = 'OUTRO',
}

/**
 * Template de despesa recorrente. A cada período gera uma `Expense` concreta.
 * Idempotência: `lastGeneratedDate` + checagem por (recurringExpenseId, dueDate)
 * garantem que o cron não duplique instâncias.
 */
@Entity('recurring_expenses')
export class RecurringExpense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  description!: string;

  @Column({ type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => ExpenseCategory, { nullable: false })
  @JoinColumn({ name: 'categoryId' })
  category?: ExpenseCategory;

  @Column({ type: 'integer' })
  amountCents!: number;

  @Column({ type: 'enum', enum: RecurrenceFrequency })
  frequency!: RecurrenceFrequency;

  /** MONTHLY: dia do mês (1..31). */
  @Column({ type: 'integer' })
  dayOfMonth!: number;

  /** WEEKLY: dia da semana (0=Domingo..6=Sábado). */
  @Column({ type: 'integer', nullable: true })
  dayOfWeek?: number;

  /** YEARLY: mês/dia no formato 'MM-DD'. */
  @Column({ type: 'integer', nullable: true })
  monthDay?: string;

  @Column({ type: 'date' })
  startDate!: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod?: PaymentMethod;

  @Column({ nullable: true })
  supplier?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[];

  /**
   * Dias antes do vencimento em que um lembrete deve ser disparado.
   * Ex.: [3, 7, 15] → avisa 15, 7 e 3 dias antes.
   */
  @Column({ type: 'integer', array: true, default: '{3}' })
  reminderDaysBefore!: number[];

  /** Data da última vez que o cron gerou uma despesa a partir deste template. */
  @Column({ type: 'date', nullable: true })
  lastGeneratedDate?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get amount(): number {
    return this.amountCents / 100;
  }
}