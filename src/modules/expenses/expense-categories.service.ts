import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategoriesRepository } from './expense-categories.repository';
import { ExpenseCategory } from './entities/expense-category.entity';

@Injectable()
export class ExpenseCategoriesService {
  constructor(private repo: ExpenseCategoriesRepository) {}

  findAll() {
    return this.repo.findAll();
  }

  findAllActive() {
    return this.repo.findAllActive();
  }

  async findOne(id: string) {
    const cat = await this.repo.findOne(id);
    if (!cat) throw new NotFoundException('Categoria não encontrada');
    return cat;
  }

  create(data: Partial<ExpenseCategory>) {
    return this.repo.create(data);
  }

  async update(id: string, patch: Partial<ExpenseCategory>) {
    await this.findOne(id);
    return this.repo.update(id, patch);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.repo.remove(id);
  }
}