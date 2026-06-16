import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { WhatsappMessage, WhatsappMessageStatus } from './entities/whatsapp-message.entity';

@Injectable()
export class WhatsappRepository {
  constructor(
    @InjectRepository(WhatsappMessage)
    private repo: Repository<WhatsappMessage>,
  ) {}

  create(data: Partial<WhatsappMessage>): WhatsappMessage {
    const entity = this.repo.create(data);
    return this.repo.save(entity) as any;
  }

  async save(entity: WhatsappMessage): Promise<WhatsappMessage> {
    return this.repo.save(entity);
  }

  findById(id: string): Promise<WhatsappMessage | null> {
    return this.repo.findOne({ where: { id } });
  }

  findAll(opts: {
    status?: WhatsappMessageStatus;
    customerId?: string;
    monthlyChargeId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<WhatsappMessage[]> {
    const where: FindOptionsWhere<WhatsappMessage> = {};
    if (opts.status) where.status = opts.status;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.monthlyChargeId) where.monthlyChargeId = opts.monthlyChargeId;
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
      take: opts.limit || 100,
      skip: opts.offset || 0,
    });
  }

  count(opts: { status?: WhatsappMessageStatus } = {}): Promise<number> {
    const where: FindOptionsWhere<WhatsappMessage> = {};
    if (opts.status) where.status = opts.status;
    return this.repo.count({ where });
  }
}
