import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  BillingNotification,
  BillingNotificationKind,
} from './entities/billing-notification.entity';

@Injectable()
export class BillingNotificationsRepository {
  constructor(
    @InjectRepository(BillingNotification)
    private repo: Repository<BillingNotification>,
  ) {}

  /**
   * Procura notificação já registrada para o par (mensalidade, kind).
   * Usado como checagem de idempotência antes de cada envio.
   */
  findExisting(
    monthlyChargeId: string,
    kind: BillingNotificationKind,
  ): Promise<BillingNotification | null> {
    return this.repo.findOne({ where: { monthlyChargeId, kind } });
  }

  create(data: Partial<BillingNotification>): Promise<BillingNotification> {
    const entity = this.repo.create(data);
    return this.repo.save(entity) as any;
  }

  save(entity: BillingNotification): Promise<BillingNotification> {
    return this.repo.save(entity);
  }

  findAll(opts: {
    monthlyChargeId?: string;
    customerId?: string;
    kind?: BillingNotificationKind;
    limit?: number;
    offset?: number;
  } = {}): Promise<BillingNotification[]> {
    const where: FindOptionsWhere<BillingNotification> = {};
    if (opts.monthlyChargeId) where.monthlyChargeId = opts.monthlyChargeId;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.kind) where.kind = opts.kind;
    return this.repo.find({
      where,
      relations: ['customer', 'monthlyCharge'],
      order: { sentAt: 'DESC' },
      take: opts.limit || 100,
      skip: opts.offset || 0,
    });
  }
}
