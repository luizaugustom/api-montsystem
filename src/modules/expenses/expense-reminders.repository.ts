import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseReminder } from './entities/expense-reminder.entity';

@Injectable()
export class ExpenseRemindersRepository {
  constructor(
    @InjectRepository(ExpenseReminder)
    private repo: Repository<ExpenseReminder>,
  ) {}

  create(data: Partial<ExpenseReminder>) {
    return this.repo.save(this.repo.create(data));
  }

  /**
   * Existe um lembrete já enviado para esta (expense, daysBefore, channel)?
   * Usado pelo cron para garantir idempotência.
   */
  async existsFor(expenseId: string, daysBefore: number, channel: string): Promise<boolean> {
    const found = await this.repo.findOne({
      where: { expenseId, daysBefore, channel: channel as any },
    });
    return !!found;
  }

  findByExpense(expenseId: string) {
    return this.repo.find({ where: { expenseId }, order: { sentAt: 'DESC' } });
  }
}