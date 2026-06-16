import { Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(private repo: CustomersRepository, private events: EventEmitter2) {}

  async create(data: Partial<Customer>) {
    const created = await this.repo.create(data);
    this.events.emit('customer.created', created);
    return created;
  }

  findAll() {
    return this.repo.findAll();
  }

  findOne(id: string) {
    return this.repo.findOne(id);
  }

  update(id: string, patch: Partial<Customer>) {
    return this.repo.update(id, patch);
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
