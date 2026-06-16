import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from './entities/ticket.entity';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(Ticket)
    private repo: Repository<Ticket>,
  ) {}

  create(entity: Partial<Ticket>) {
    return this.repo.save(this.repo.create(entity));
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  update(id: string, patch: Partial<Ticket>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  findByStatus(status: TicketStatus) {
    return this.repo.find({ where: { status }, order: { createdAt: 'DESC' } });
  }

  findByClientId(clientId: string) {
    return this.repo.find({ where: { clientId }, order: { createdAt: 'DESC' } });
  }

  findByPriority(priority: TicketPriority) {
    return this.repo.find({ where: { priority }, order: { createdAt: 'DESC' } });
  }
}
