import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';

@Injectable()
export class SalesRepository {
  constructor(@InjectRepository(Sale as any) private repo: Repository<Sale>) {}

  create(entity: Partial<Sale>) {
    return this.repo.save(this.repo.create(entity as any));
  }

  findAll() {
    return this.repo.find();
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } as any } as any);
  }

  update(id: string, patch: Partial<Sale>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  findBySaleMonths(months: string[]) {
    return this.repo.find().then((rows) => rows.filter((r) => months.some((m) => r.saleDate?.startsWith(m))));
  }
}
