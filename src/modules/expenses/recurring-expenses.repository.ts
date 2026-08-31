import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringExpense } from './entities/recurring-expense.entity';

@Injectable()
export class RecurringExpensesRepository {
  constructor(
    @InjectRepository(RecurringExpense)
    private repo: Repository<RecurringExpense>,
  ) {}

  create(data: Partial<RecurringExpense>) {
    return this.repo.save(this.repo.create(data));
  }

  save(data: Partial<RecurringExpense>) {
    return this.repo.save(data);
  }

  findAll() {
    return this.repo.find({ relations: ['category'], order: { createdAt: 'DESC' } });
  }

  findActive() {
    return this.repo.find({
      where: { active: true },
      relations: ['category'],
    });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id }, relations: ['category'] });
  }

  update(id: string, patch: Partial<RecurringExpense>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
}