import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, LessThanOrEqual } from 'typeorm';
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

  async saveMany(entities: WhatsappMessage[]): Promise<WhatsappMessage[]> {
    return this.repo.save(entities as any);
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

  /** Busca mensagens enfileiradas prontas para envio (bulk + 1-a-1). */
  findPendingScheduled(limit: number, now: Date = new Date()): Promise<WhatsappMessage[]> {
    return this.repo.find({
      where: { status: WhatsappMessageStatus.QUEUED, scheduledAt: LessThanOrEqual(now) as any },
      order: { scheduledAt: 'ASC' },
      take: limit,
    });
  }

  /** Busca mensagens com falha candidatas a retry (após janela de retry). */
  findFailedEligibleForRetry(limit: number, olderThan: Date): Promise<WhatsappMessage[]> {
    return this.repo
      .createQueryBuilder('m')
      .where('m.status = :status', { status: WhatsappMessageStatus.FAILED })
      .andWhere('m.attempts < :max', { max: 999 }) // filtro é aplicado fora (config-driven)
      .andWhere('m.createdAt <= :olderThan', { olderThan })
      .orderBy('m.createdAt', 'ASC')
      .limit(limit)
      .getMany();
  }

  /** Status agregado de uma campanha (dispatchId). */
  countByDispatch(dispatchId: string): Promise<{ status: WhatsappMessageStatus; count: string }[]> {
    return this.repo
      .createQueryBuilder('m')
      .select('m.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('m.dispatchId = :dispatchId', { dispatchId })
      .groupBy('m.status')
      .getRawMany();
  }
}
