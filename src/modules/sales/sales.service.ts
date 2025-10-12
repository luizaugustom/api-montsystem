import { Injectable } from '@nestjs/common';
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

@Injectable()
export class SalesService {
  constructor(private repo: SalesRepository, private events: EventEmitter2) {}

  async create(data: CreateSaleData) {
    // Converter valores em reais para centavos antes de salvar
    const saleData: Partial<Sale> = {
      ...data,
      saleValueCents: data.saleValue ? toCents(data.saleValue) : undefined,
      entryValueCents: data.entryValue ? toCents(data.entryValue) : undefined,
      monthlyValueCents: data.monthlyValue ? toCents(data.monthlyValue) : undefined,
      isMonthly: data.isMonthly || false,
    };

    // Remove campos que não existem na entidade (evitar conflitos)
    delete (saleData as any).saleValue;
    delete (saleData as any).entryValue;
    delete (saleData as any).monthlyValue;

    const created = await this.repo.create(saleData);
    this.events.emit('sale.created', created);
    
    // Retorna com valores calculados dos getters
    // Verifica se created é um array ou objeto único
    const sale = Array.isArray(created) ? created[0] : created;
    return this.transformSaleForResponse(sale);
  }

  async findAll() {
    const sales = await this.repo.findAll();
    return sales.map(sale => this.transformSaleForResponse(sale));
  }

  async findOne(id: string) {
    const sale = await this.repo.findOne(id);
    return sale ? this.transformSaleForResponse(sale) : null;
  }

  async update(id: string, data: Partial<CreateSaleData>) {
    // Converter valores em reais para centavos antes de atualizar
    const updateData: Partial<Sale> = {
      ...data,
      saleValueCents: data.saleValue ? toCents(data.saleValue) : undefined,
      entryValueCents: data.entryValue ? toCents(data.entryValue) : undefined,
      monthlyValueCents: data.monthlyValue ? toCents(data.monthlyValue) : undefined,
    };

    // Remove campos que não existem na entidade
    delete (updateData as any).saleValue;
    delete (updateData as any).entryValue;
    delete (updateData as any).monthlyValue;

    const updated = await this.repo.update(id, updateData);
    return updated ? this.transformSaleForResponse(updated) : null;
  }

  remove(id: string) {
    return this.repo.remove(id);
  }

  async findByMonths(months: string[]) {
    const sales = await this.repo.findBySaleMonths(months);
    return sales.map(sale => this.transformSaleForResponse(sale));
  }

  /**
   * Transforma Sale entity para incluir valores calculados na resposta
   */
  private transformSaleForResponse(sale: Sale) {
    return {
      ...sale,
      saleValue: sale.saleValue, // getter da entity
      saleValueCents: sale.saleValueCents,
      entryValue: sale.entryValue, // getter da entity
      monthlyValue: sale.monthlyValue, // getter da entity
    };
  }
}
