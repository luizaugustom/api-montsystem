import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';

@Injectable()
export class InvoicesRepository {
  constructor(@InjectRepository(Invoice as any) private repo: Repository<Invoice>) {}

  create(entity: Partial<Invoice>) {
    return this.repo.save(this.repo.create(entity as any));
  }

  findAll() {
    return this.repo.find({
      relations: ['sale', 'items'],
      order: { createdAt: 'DESC' }
    });
  }

  findOne(id: string) {
    return this.repo.findOne({
      where: { id } as any,
      relations: ['sale', 'items']
    } as any);
  }

  findByNumber(number: string) {
    return this.repo.findOne({
      where: { number } as any
    } as any);
  }

  findBySaleId(saleId: string) {
    return this.repo.find({
      where: { saleId } as any,
      relations: ['sale', 'items']
    } as any);
  }

  findByStatus(status: InvoiceStatus) {
    return this.repo.find({
      where: { status } as any,
      relations: ['sale', 'items'],
      order: { createdAt: 'DESC' }
    } as any);
  }

  update(id: string, patch: Partial<Invoice>) {
    return this.repo.save(Object.assign({}, patch, { id }));
  }

  updateStatus(id: string, status: InvoiceStatus, additionalData?: Partial<Invoice>) {
    return this.repo.save(Object.assign({}, additionalData, { id, status }));
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  // Buscar notas fiscais por período
  findByDateRange(startDate: string, endDate: string) {
    return this.repo.createQueryBuilder('invoice')
      .where('invoice.issueDate >= :startDate', { startDate })
      .andWhere('invoice.issueDate <= :endDate', { endDate })
      .leftJoinAndSelect('invoice.sale', 'sale')
      .leftJoinAndSelect('invoice.items', 'items')
      .orderBy('invoice.issueDate', 'DESC')
      .getMany();
  }

  // Estatísticas de notas fiscais
  async getStats() {
    const [total, authorized, cancelled, pending] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { status: InvoiceStatus.AUTHORIZED } as any }),
      this.repo.count({ where: { status: InvoiceStatus.CANCELLED } as any }),
      this.repo.count({ where: { status: InvoiceStatus.PENDING } as any })
    ]);

    return { total, authorized, cancelled, pending };
  }

  // Buscar último número por série
  findLastBySeries(series: string) {
    return this.repo.findOne({
      where: { series } as any,
      order: { number: 'DESC' } as any
    } as any);
  }
}