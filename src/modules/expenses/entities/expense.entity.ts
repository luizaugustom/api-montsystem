import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { RecurringExpense, PaymentMethod } from './recurring-expense.entity';

export enum ExpenseStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

/**
 * Despesa concreta — instância gerada (manual ou a partir de uma RecurringExpense).
 * `recurringExpenseId` aponta para o template de origem, se houver.
 */
@Entity('expenses')
@Index(['dueDate'])
@Index(['status', 'dueDate'])
export class Expense {
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

  @Column({ type: 'date' })
  dueDate!: string;

  @Column({ type: 'date', nullable: true })
  paidDate?: string;

  @Column({
    type: 'enum',
    enum: ExpenseStatus,
    default: ExpenseStatus.PENDING,
  })
  status!: ExpenseStatus;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod?: PaymentMethod;

  @Column({ nullable: true })
  supplier?: string;

  @Column({ nullable: true })
  notes?: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[];

  @Column({ type: 'uuid', nullable: true })
  recurringExpenseId?: string;

  @ManyToOne(() => RecurringExpense, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recurringExpenseId' })
  recurringExpense?: RecurringExpense;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get amount(): number {
    return this.amountCents / 100;
  }
}