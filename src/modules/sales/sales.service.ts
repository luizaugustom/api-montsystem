import { Injectable, NotFoundException, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { SalesRepository } from './sales.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Sale, SaleStatus } from './entities/sale.entity';
import { toCents } from '../../shared/utils/currency';
import { InvoicesService } from '../invoices/invoices.service';

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
  constructor(
    private repo: SalesRepository,
    private events: EventEmitter2,
    // forwardRef: ciclo com InvoicesModule. SalesService injeta InvoicesService
    // para o endpoint manual `POST /sales/:id/issue-invoice`.
    @Inject(forwardRef(() => InvoicesService))
    private invoicesService: InvoicesService,
  ) {}

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
      status: SaleStatus.PENDING,
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

  /**
   * Marca a venda como paga manualmente (endpoint `POST /sales/:id/mark-paid`).
   * Emite `sale.paid` para que o listener no InvoicesModule dispare a
   * emissão automática de NFSe consolidada da venda.
   *
   * Idempotência: se já está PAID, retorna a venda sem re-emitir.
   */
  async markAsPaid(id: string): Promise<Sale> {
    const sale = await this.repo.findOne(id);
    if (!sale) throw new NotFoundException('Venda não encontrada');

    if (sale.status === SaleStatus.PAID) {
      return this.transformSaleForResponse(sale);
    }

    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('Venda cancelada não pode ser marcada como paga.');
    }

    sale.status = SaleStatus.PAID;
    sale.paidAt = new Date().toISOString().slice(0, 10);
    const updated = await this.repo.save(sale);

    this.events.emit('sale.paid', { sale: updated });
    return this.transformSaleForResponse(updated);
  }

  /**
   * Cancela a venda. Emite `sale.cancelled` (sem listener hoje).
   */
  async cancel(id: string): Promise<Sale> {
    const sale = await this.repo.findOne(id);
    if (!sale) throw new NotFoundException('Venda não encontrada');
    sale.status = SaleStatus.CANCELLED;
    const updated = await this.repo.save(sale);
    this.events.emit('sale.cancelled', { sale: updated });
    return this.transformSaleForResponse(updated);
  }

  /**
   * Emite NFSe manual a partir de uma venda (endpoint `POST /sales/:id/issue-invoice`).
   * Cria Invoice (DRAFT) → envia via Focus NFe → persiste em `invoices` e `nfse`.
   * Idempotência: se já houver invoice AUTHORIZED para esta venda, retorna a existente.
   */
  async issueInvoice(id: string) {
    const sale = await this.repo.findOne(id);
    if (!sale) throw new NotFoundException('Venda não encontrada');
    return this.invoicesService.createFromSale(sale.id);
  }

  private transformSaleForResponse(sale: Sale) {
    return {
      ...sale,
      saleValue: sale.saleValue,
      saleValueCents: sale.saleValueCents,
      entryValue: sale.entryValue,
      monthlyValue: sale.monthlyValue,
      status: sale.status,
      paidAt: sale.paidAt,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    };
  }
}
