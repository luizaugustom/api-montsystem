import { Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer } from './entities/customer.entity';
import {
  buildMonthlyValueHistoryOnChange,
  seedMonthlyValueHistory,
} from './monthly-value-history';

@Injectable()
export class CustomersService {
  constructor(private repo: CustomersRepository, private events: EventEmitter2) {}

  async create(data: Partial<Customer>) {
    const monthlyValueHistory =
      data.monthlyValueHistory ??
      seedMonthlyValueHistory(data.monthlyValue as any, data.acquisitionDate);
    const created = await this.repo.create({ ...data, monthlyValueHistory });
    this.events.emit('customer.created', created);
    return created;
  }

  findAll() {
    return this.repo.findAll();
  }

  findActive() {
    return this.repo.findAllActive();
  }

  findOne(id: string) {
    return this.repo.findOne(id);
  }

  async update(id: string, patch: Partial<Customer>) {
    const existing = await this.repo.findOne(id);
    if (!existing) return this.repo.update(id, patch);

    const nextPatch: Partial<Customer> = { ...patch };
    if (patch.monthlyValue !== undefined) {
      nextPatch.monthlyValueHistory = buildMonthlyValueHistoryOnChange(
        existing,
        patch.monthlyValue as any,
      );
    }

    return this.repo.update(id, nextPatch);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }

  findByMonths(months: string[]) {
    return this.repo.findByNextPaymentMonths(months);
  }

  /**
   * Lookup em batch — usado pelo TicketsService para enriquecer listas
   * com `clientName` sem causar N+1 queries. Retorna um Map<id, Customer>.
   */
  async findByIds(ids: string[]): Promise<Map<string, Customer>> {
    const unique = Array.from(new Set((ids || []).filter(Boolean)));
    if (!unique.length) return new Map();
    const all = await this.repo.findAll();
    const byId = new Map<string, Customer>();
    for (const c of all) {
      if (unique.includes(c.id)) byId.set(c.id, c);
    }
    return byId;
  }
}
