import { Injectable, Logger, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as path from 'path';
import { BoletosRepository } from './boletos.repository';
import { Boleto, BoletoStatus } from './entities/boleto.entity';
import { UnimakeService, UnimakeEmitirPayload } from '../../shared/services/unimake.service';
import { CustomersRepository } from '../customers/customers.repository';
import { buildCustomerAddress } from '../customers/customer-address';
import { MonthlyCharge, MonthlyChargeStatus } from '../monthly-charges/entities/monthly-charge.entity';
import { MonthlyChargesRepository } from '../monthly-charges/monthly-charges.repository';
import dayjs from 'dayjs';

@Injectable()
export class BoletosService {
  private readonly logger = new Logger(BoletosService.name);

  constructor(
    private repo: BoletosRepository,
    private customersRepo: CustomersRepository,
    private monthlyRepo: MonthlyChargesRepository,
    private unimake: UnimakeService,
    private events: EventEmitter2,
  ) {}

  /**
   * Emite boleto para uma mensalidade (monthlyCharge) ou avulso.
   */
  async issue(opts: {
    monthlyChargeId?: string;
    customerId?: string;
    valorCents?: number;
    vencimento?: string;
    descricao?: string;
    nossoNumero?: string;
  }): Promise<Boleto> {
    let customer: any;
    let valorCents: number;
    let vencimento: string;
    let descricao: string;
    let charge: MonthlyCharge | null = null;

    if (opts.monthlyChargeId) {
      // Carrega a mensalidade e o cliente dela
      charge = await this.monthlyRepo.findById(opts.monthlyChargeId);
      if (!charge) throw new NotFoundException('Mensalidade não encontrada');
      customer = await this.customersRepo.findOne(charge.customerId);
      if (!customer) throw new NotFoundException('Cliente não encontrado');
      valorCents = charge.valorCents;
      vencimento = charge.vencimento;
      descricao = `Mensalidade ${dayjs(charge.competencia).format('MM/YYYY')} - ${customer.name}`;
    } else {
      if (!opts.customerId) throw new BadRequestException('customerId é obrigatório');
      customer = await this.customersRepo.findOne(opts.customerId);
      if (!customer) throw new NotFoundException('Cliente não encontrado');
      if (!opts.valorCents) throw new BadRequestException('valorCents é obrigatório');
      valorCents = opts.valorCents;
      vencimento = opts.vencimento || dayjs().add(7, 'day').format('YYYY-MM-DD');
      descricao = opts.descricao || 'Cobrança avulsa';
    }

    if (!customer.cpfOrCnpj) {
      throw new BadRequestException('Cliente sem CPF/CNPJ cadastrado');
    }
    if (!customer.phone) {
      throw new BadRequestException('Cliente sem telefone cadastrado');
    }

    const valor = valorCents / 100;

    const payload: UnimakeEmitirPayload = {
      nossoNumero: opts.nossoNumero,
      pagador: {
        nome: customer.name,
        cpfCnpj: customer.cpfOrCnpj.replace(/\D/g, ''),
        email: customer.email,
        telefone: customer.phone,
        endereco: buildCustomerAddress(customer),
      },
      valor,
      vencimento,
      descricao,
      referencia: charge?.id || `avulso-${customer.id}`,
    };

    const res = await this.unimake.emitirBoleto(payload);
    if (!res.sucesso) {
      this.logger.error(`Unimake falhou: ${res.mensagem}`);
      // Grava boleto com erro para auditoria
      const errored = await this.repo.create({
        nossoNumero: opts.nossoNumero || `ERR-${Date.now()}`,
        customerId: customer.id,
        monthlyChargeId: charge?.id,
        valorCents,
        vencimento,
        status: BoletoStatus.ERROR,
        errorMessage: res.mensagem,
        payloadJson: payload as any,
      });
      throw new BadRequestException(`Erro ao emitir boleto: ${res.mensagem}`);
    }

    // Cria registro
    const boleto = await this.repo.create({
      nossoNumero: res.nossoNumero,
      customerId: customer.id,
      monthlyChargeId: charge?.id,
      valorCents,
      vencimento,
      status: BoletoStatus.ISSUED,
      linhaDigitavel: res.linhaDigitavel,
      codigoBarras: res.codigoBarras,
      urlPdf: res.urlPdf,
      urlXml: res.urlXml,
      unimakeId: res.id,
      payloadJson: payload as any,
    });

    // Baixa o PDF para cache local
    if (res.urlPdf) {
      const localPath = path.join(process.cwd(), 'storage', 'boletos', 'pdf', `${boleto.nossoNumero}.pdf`);
      this.unimake.downloadPdf(res.urlPdf, localPath)
        .then((ok) => {
          if (ok) this.repo.save({ ...boleto, localPdfPath: localPath } as any);
        })
        .catch((e) => this.logger.warn(`Falha cache PDF: ${e?.message}`));
    }

    // Vincula à mensalidade
    if (charge) {
      charge.boletoId = boleto.id;
      charge.status = MonthlyChargeStatus.BOLETO_ISSUED;
      await this.monthlyRepo.save(charge);
    }

    this.events.emit('boleto.issued', { boleto, customer, monthlyCharge: charge });
    return boleto;
  }

  async findAll(opts: Parameters<BoletosRepository['findAll']>[0] = {}) {
    return this.repo.findAll(opts);
  }

  async findOne(id: string) {
    const b = await this.repo.findById(id);
    if (!b) throw new NotFoundException('Boleto não encontrado');
    return b;
  }

  async getPdf(id: string): Promise<{ path: string; filename: string } | null> {
    const b = await this.findOne(id);
    if (b.localPdfPath) return { path: b.localPdfPath, filename: `${b.nossoNumero}.pdf` };
    if (b.urlPdf) {
      const localPath = path.join(process.cwd(), 'storage', 'boletos', 'pdf', `${b.nossoNumero}.pdf`);
      const ok = await this.unimake.downloadPdf(b.urlPdf, localPath);
      if (ok) {
        b.localPdfPath = localPath;
        await this.repo.save(b);
        return { path: localPath, filename: `${b.nossoNumero}.pdf` };
      }
    }
    return null;
  }

  /**
   * Marca um boleto como pago. Chamado pelo webhook ou cron.
   * Emite evento boleto.paid que será capturado pelos listeners.
   */
  async markAsPaid(opts: {
    boletoId?: string;
    nossoNumero?: string;
    paidAmountCents?: number;
    paidAt?: string;
  }): Promise<Boleto> {
    let boleto: Boleto | null = null;
    if (opts.boletoId) boleto = await this.repo.findById(opts.boletoId);
    if (!boleto && opts.nossoNumero) boleto = await this.repo.findByNossoNumero(opts.nossoNumero);
    if (!boleto) throw new NotFoundException('Boleto não encontrado');

    if (boleto.status === BoletoStatus.PAID) {
      this.logger.log(`Boleto ${boleto.nossoNumero} já estava pago (idempotente)`);
      return boleto;
    }
    if (boleto.status === BoletoStatus.CANCELLED) {
      throw new BadRequestException('Boleto cancelado não pode ser marcado como pago');
    }

    boleto.status = BoletoStatus.PAID;
    boleto.paidAt = opts.paidAt || new Date().toISOString().slice(0, 10);
    boleto.paidAmountCents = opts.paidAmountCents ?? boleto.valorCents;
    await this.repo.save(boleto);

    this.events.emit('boleto.paid', { boleto });
    return boleto;
  }

  async cancel(id: string): Promise<Boleto> {
    const b = await this.findOne(id);
    if (b.status === BoletoStatus.PAID) {
      throw new BadRequestException('Boleto já pago não pode ser cancelado');
    }
    const res = await this.unimake.cancelarBoleto(b.nossoNumero);
    if (!res.sucesso) {
      this.logger.warn(`Unimake cancelar falhou: ${res.mensagem}`);
    }
    b.status = BoletoStatus.CANCELLED;
    await this.repo.save(b);
    return b;
  }

  /**
   * Cron de reconciliação: consulta Unimake para boletos pendentes próximos do vencimento.
   */
  async reconcilePending(): Promise<{ checked: number; updated: number }> {
    const pending = await this.repo.findAll({ status: BoletoStatus.ISSUED, limit: 500 });
    let updated = 0;
    for (const b of pending) {
      const status = await this.unimake.consultarBoleto(b.nossoNumero);
      if (status.situacao === 'pago' || status.situacao === 'liquidado' || status.situacao === 'baixa') {
        await this.markAsPaid({
          boletoId: b.id,
          paidAmountCents: status.valorPago ? Math.round(status.valorPago * 100) : b.valorCents,
          paidAt: status.dataPagamento,
        });
        updated++;
      } else if (status.situacao === 'vencido' || status.situacao === 'atrasado') {
        b.status = BoletoStatus.OVERDUE;
        await this.repo.save(b);
        updated++;
      }
    }
    return { checked: pending.length, updated };
  }
}
