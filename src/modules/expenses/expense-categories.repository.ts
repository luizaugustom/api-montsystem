import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from './entities/expense-category.entity';

@Injectable()
export class ExpenseCategoriesRepository {
  constructor(
    @InjectRepository(ExpenseCategory)
    private repo: Repository<ExpenseCategory>,
  ) {}

  create(data: Partial<ExpenseCategory>) {
    return this.repo.save(this.repo.create(data));
  }

  save(data: Partial<ExpenseCategory>) {
    return this.repo.save(data);
  }

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findAllActive() {
    return this.repo.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  update(id: string, patch: Partial<ExpenseCategory>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }
}