import { Injectable, NotFoundException } from '@nestjs/common';
import { SalesRepository } from './sales.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Sale } from './entities/sale.entity';
import { toCents } from '../../shared/utils/currency';

interface CreateSaleData {
  clientName: string;
  phone: string;
  cpfOrCnpj?: string;
  address?: string;
  saleDate?: string;
  warrantyEndDate?: string;
  productDescription?: string;
  clientId?: string;
  saleValue?: number;
  isMonthly?: boolean;
  entryValue?: number;
  monthlyValue?: number;
  nextPaymentDate?: string;
  contractFile?: string;
  invoiceFile?: string;
}

function omitUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as any)[k] = v;
  }
  return out;
}

@Injectable()
export class SalesService {
  constructor(private repo: SalesRepository, private events: EventEmitter2) {}

  async create(data: CreateSaleData) {
    const saleData: Partial<Sale> = omitUndefined({
      clientName: data.clientName,
      phone: data.phone || '',
      cpfOrCnpj: data.cpfOrCnpj,
      address: data.address,
      saleDate: data.saleDate,
      warrantyEndDate: data.warrantyEndDate,
      productDescription: data.productDescription,
      clientId: data.clientId,
      contractFile: data.contractFile,
      invoiceFile: data.invoiceFile,
      nextPaymentDate: data.nextPaymentDate,
      saleValueCents: data.saleValue != null ? toCents(data.saleValue) : undefined,
      entryValueCents: data.entryValue != null ? toCents(data.entryValue) : undefined,
      monthlyValueCents: data.monthlyValue != null ? toCents(data.monthlyValue) : undefined,
      isMonthly: data.isMonthly || false,
    });

    const created = await this.repo.create(saleData);
    this.events.emit('sale.created', created);

    const sale = Array.isArray(created) ? created[0] : created;
    return this.transformSaleForResponse(sale);
  }

  async findAll() {
    const sales = await this.repo.findAll();
    return sales.map((sale) => this.transformSaleForResponse(sale));
  }

  async findOne(id: string) {
    const sale = await this.repo.findOne(id);
    return sale ? this.transformSaleForResponse(sale) : null;
  }

  async update(id: string, data: Partial<CreateSaleData>) {
    const existing = await this.repo.findOne(id);
    if (!existing) throw new NotFoundException('Venda não encontrada');

    const patch: Partial<Sale> = omitUndefined({
      clientName: data.clientName,
      phone: data.phone,
      cpfOrCnpj: data.cpfOrCnpj,
      address: data.address,
      saleDate: data.saleDate,
      warrantyEndDate: data.warrantyEndDate,
      productDescription: data.productDescription,
      clientId: data.clientId,
      contractFile: data.contractFile,
      invoiceFile: data.invoiceFile,
      nextPaymentDate: data.nextPaymentDate,
      isMonthly: data.isMonthly,
      saleValueCents: data.saleValue != null ? toCents(data.saleValue) : undefined,
      entryValueCents: data.entryValue != null ? toCents(data.entryValue) : undefined,
      monthlyValueCents: data.monthlyValue != null ? toCents(data.monthlyValue) : undefined,
    });

    // Datas opcionais: se vierem explicitamente como undefined no omit, não toca;
    // se o cliente limpar a data, o controller já remove o campo — mantém o existente.
    Object.assign(existing, patch);
    const updated = await this.repo.save(existing);
    return this.transformSaleForResponse(updated);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }

  async findByMonths(months: string[]) {
    const sales = await this.repo.findBySaleMonths(months);
    return sales.map((sale) => this.transformSaleForResponse(sale));
  }

  private transformSaleForResponse(sale: Sale) {
    return {
      ...sale,
      saleValue: sale.saleValue,
      saleValueCents: sale.saleValueCents,
      entryValue: sale.entryValue,
      monthlyValue: sale.monthlyValue,
    };
  }
}
