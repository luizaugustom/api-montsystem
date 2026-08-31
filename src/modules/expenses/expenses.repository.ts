import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';

export type FindAllOpts = {
  status?: ExpenseStatus;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

@Injectable()
export class ExpensesRepository {
  constructor(
    @InjectRepository(Expense)
    private repo: Repository<Expense>,
  ) {}

  create(data: Partial<Expense>) {
    return this.repo.save(this.repo.create(data));
  }

  save(data: Partial<Expense>) {
    return this.repo.save(data);
  }

  findAll(opts: FindAllOpts = {}) {
    const where: any = {};
    if (opts.status) where.status = opts.status;
    if (opts.categoryId) where.categoryId = opts.categoryId;
    if (opts.startDate && opts.endDate) {
      where.dueDate = Between(opts.startDate, opts.endDate);
    }
    return this.repo.find({
      where,
      relations: ['category'],
      order: { dueDate: 'ASC', createdAt: 'DESC' },
      take: opts.limit ?? 500,
    });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['category', 'recurringExpense'] });
  }

  update(id: string, patch: Partial<Expense>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  /**
   * Despesas com vencimento entre [from, to] (inclusivo) e status PENDING.
   * Usado pelo painel de lembretes in-app.
   */
  findUpcoming(from: string, to: string, limit = 50) {
    return this.repo.find({
      where: {
        dueDate: Between(from, to),
        status: In([ExpenseStatus.PENDING, ExpenseStatus.OVERDUE]),
      },
      relations: ['category'],
      order: { dueDate: 'ASC' },
      take: limit,
    });
  }

  /** Despesas vencidas (dueDate < today) e ainda PENDING ou OVERDUE. */
  findOverdue(today: string) {
    return this.repo.find({
      where: { dueDate: LessThan(today), status: ExpenseStatus.PENDING },
      relations: ['category'],
      order: { dueDate: 'ASC' },
    });
  }

  /** Para idempotência da geração recorrente. */
  findByRecurringAndDueDate(recurringExpenseId: string, dueDate: string) {
    return this.repo.findOne({
      where: { recurringExpenseId, dueDate },
    });
  }
}