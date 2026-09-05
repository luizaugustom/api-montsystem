import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Boleto, BoletoStatus } from './entities/boleto.entity';

@Injectable()
export class BoletosRepository {
  constructor(
    @InjectRepository(Boleto)
    private repo: Repository<Boleto>,
  ) {}

  create(data: Partial<Boleto>): Promise<Boleto> {
    const entity = this.repo.create(data);
    return this.repo.save(entity) as any;
  }

  save(entity: Boleto): Promise<Boleto> {
    return this.repo.save(entity);
  }

  findById(id: string): Promise<Boleto | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['customer', 'sale', 'monthlyCharge'],
    });
  }

  findByNossoNumero(nossoNumero: string): Promise<Boleto | null> {
    return this.repo.findOne({
      where: { nossoNumero },
      relations: ['customer', 'sale', 'monthlyCharge'],
    });
  }

  findAll(opts: {
    status?: BoletoStatus;
    customerId?: string;
    monthlyChargeId?: string;
    saleId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<Boleto[]> {
    const where: FindOptionsWhere<Boleto> = {};
    if (opts.status) where.status = opts.status;
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.monthlyChargeId) where.monthlyChargeId = opts.monthlyChargeId;
    if (opts.saleId) where.saleId = opts.saleId;
    const qb = this.repo
      .createQueryBuilder('boleto')
      .leftJoinAndSelect('boleto.customer', 'customer')
      .leftJoinAndSelect('boleto.sale', 'sale')
      .leftJoinAndSelect('boleto.monthlyCharge', 'monthlyCharge')
      .where(where)
      .orderBy('boleto.createdAt', 'DESC')
      .take(opts.limit || 100)
      .skip(opts.offset || 0);
    if (opts.startDate) qb.andWhere('boleto.vencimento >= :start', { start: opts.startDate });
    if (opts.endDate) qb.andWhere('boleto.vencimento <= :end', { end: opts.endDate });
    return qb.getMany();
  }

  count(opts: { status?: BoletoStatus; vencimentoBefore?: string } = {}): Promise<number> {
    const qb = this.repo.createQueryBuilder('boleto');
    if (opts.status) qb.andWhere('boleto.status = :status', { status: opts.status });
    if (opts.vencimentoBefore) qb.andWhere('boleto.vencimento <= :d', { d: opts.vencimentoBefore });
    return qb.getCount();
  }

  findOverdue(referenceDate: string): Promise<Boleto[]> {
    return this.repo
      .createQueryBuilder('boleto')
      .leftJoinAndSelect('boleto.customer', 'customer')
      .leftJoinAndSelect('boleto.sale', 'sale')
      .leftJoinAndSelect('boleto.monthlyCharge', 'monthlyCharge')
      .where('boleto.status IN (:...statuses)', { statuses: [BoletoStatus.ISSUED] })
      .andWhere('boleto.vencimento < :d', { d: referenceDate })
      .getMany();
  }

  /**
   * Lista boletos diretamente vinculados a uma venda.
   * (Não inclui boletos nascidos de mensalidades que pertencem à venda —
   * estes ficam em `monthly_charges.boletoId` e podem ser buscados via
   * `MonthlyChargesRepository.findBySaleId(saleId).map(c => c.boleto)`.)
   */
  findBySaleId(saleId: string): Promise<Boleto[]> {
    return this.repo.find({
      where: { saleId },
      relations: ['customer', 'sale', 'monthlyCharge'],
    });
  }

  /** Lista boletos vinculados a uma mensalidade específica. */
  findByMonthlyChargeId(monthlyChargeId: string): Promise<Boleto[]> {
    return this.repo.find({
      where: { monthlyChargeId },
      relations: ['customer', 'sale', 'monthlyCharge'],
    });
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
