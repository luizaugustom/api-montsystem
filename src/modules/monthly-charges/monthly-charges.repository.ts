import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { MonthlyCharge, MonthlyChargeStatus } from './entities/monthly-charge.entity';

@Injectable()
export class MonthlyChargesRepository {
  constructor(
    @InjectRepository(MonthlyCharge)
    private repo: Repository<MonthlyCharge>,
  ) {}

  findById(id: string): Promise<MonthlyCharge | null> {
    return this.repo.findOne({ where: { id }, relations: ['customer', 'boleto'] });
  }

  findAll(opts: {
    status?: MonthlyChargeStatus;
    customerId?: string;
    competencia?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<MonthlyCharge[]> {
    const qb = this.repo.createQueryBuilder('m')
      .leftJoinAndSelect('m.customer', 'customer')
      .leftJoinAndSelect('m.boleto', 'boleto')
      .orderBy('m.vencimento', 'DESC')
      .take(opts.limit || 100)
      .skip(opts.offset || 0);
    if (opts.status) qb.andWhere('m.status = :status', { status: opts.status });
    if (opts.customerId) qb.andWhere('m.customerId = :cid', { cid: opts.customerId });
    if (opts.competencia) qb.andWhere('m.competencia = :c', { c: opts.competencia });
    if (opts.startDate) qb.andWhere('m.vencimento >= :s', { s: opts.startDate });
    if (opts.endDate) qb.andWhere('m.vencimento <= :e', { e: opts.endDate });
    return qb.getMany();
  }

  findOverdue(referenceDate: string): Promise<MonthlyCharge[]> {
    return this.repo.createQueryBuilder('m')
      .leftJoinAndSelect('m.customer', 'customer')
      .leftJoinAndSelect('m.boleto', 'boleto')
      .where('m.status IN (:...statuses)', { statuses: [MonthlyChargeStatus.PENDING, MonthlyChargeStatus.BOLETO_ISSUED, MonthlyChargeStatus.OVERDUE] })
      .andWhere('m.vencimento < :d', { d: referenceDate })
      .orderBy('m.vencimento', 'ASC')
      .getMany();
  }

  /**
   * Busca mensalidades com vencimento exatamente em uma data e status entre os
   * informados. Usado pelos jobs automáticos (5d antes, hoje, 5d após).
   */
  findByVencimentoAndStatuses(
    date: string,
    statuses: MonthlyChargeStatus[],
  ): Promise<MonthlyCharge[]> {
    return this.repo.createQueryBuilder('m')
      .leftJoinAndSelect('m.customer', 'customer')
      .leftJoinAndSelect('m.boleto', 'boleto')
      .where('m.vencimento = :d', { d: date })
      .andWhere('m.status IN (:...statuses)', { statuses })
      .orderBy('m.createdAt', 'ASC')
      .getMany();
  }

  findExisting(customerId: string, competencia: string): Promise<MonthlyCharge | null> {
    return this.repo.findOne({ where: { customerId, competencia } });
  }

  /**
   * Lista mensalidades vinculadas a uma venda específica. Usado pelo listener
   * que detecta quando todos os charges de uma venda estão pagos.
   */
  findBySaleId(saleId: string): Promise<MonthlyCharge[]> {
    return this.repo.find({ where: { saleId } as any, relations: ['customer', 'boleto'] });
  }

  create(data: Partial<MonthlyCharge>): Promise<MonthlyCharge> {
    const entity = this.repo.create(data);
    return this.repo.save(entity) as any;
  }

  save(entity: MonthlyCharge): Promise<MonthlyCharge> {
    return this.repo.save(entity);
  }

  count(opts: { status?: MonthlyChargeStatus } = {}): Promise<number> {
    const where: FindOptionsWhere<MonthlyCharge> = {};
    if (opts.status) where.status = opts.status;
    return this.repo.count({ where });
  }

  sumValorByStatus(status: MonthlyChargeStatus): Promise<{ sum: number } | any> {
    return this.repo
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.valorCents), 0)', 'sum')
      .where('m.status = :s', { s: status })
      .getRawOne();
  }
}
