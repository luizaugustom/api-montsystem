import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersRepository {
  constructor(
    @InjectRepository(Customer)
    private repo: Repository<Customer>,
  ) {}

  create(entity: Partial<Customer>) {
    return this.repo.save(this.repo.create(entity));
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  update(id: string, patch: Partial<Customer>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  findByNextPaymentMonths(monthPrefixes: string[]) {
    // simple approach: find all and filter in memory (can be optimized)
    return this.repo.find().then((rows) => rows.filter((r) => monthPrefixes.some((m) => r.nextPaymentDate?.startsWith(m))));
  }
}
