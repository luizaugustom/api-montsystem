import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { MonthlyChargesRepository } from './monthly-charges.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { MonthlyCharge, MonthlyChargeStatus } from './entities/monthly-charge.entity';
import { BoletosService } from '../boletos/boletos.service';
import { FocusNfeService } from '../nfse/services/focus-nfe.service';
import { IntegrationsStorage } from '../integrations/integrations-storage';
import { Boleto } from '../boletos/entities/boleto.entity';

@Injectable()
export class MonthlyChargesService {
  private readonly logger = new Logger(MonthlyChargesService.name);

  constructor(
    private repo: MonthlyChargesRepository,
    private customersRepo: CustomersRepository,
    private eventos: EventEmitter2,
    private boletosService: BoletosService,
    private focusNfe: FocusNfeService,
    private integrations: IntegrationsStorage,
  ) {}

  /**
   * Gera mensalidades para todos os clientes ativos com mensalidade.
   * Idempotente: usa UNIQUE(customerId, competencia) na entidade.
   */
  async generate(opts: { competencia?: string; onlyCustomerIds?: string[] } = {}): Promise<{ created: number; skipped: number }> {
    const competencia = opts.competencia || dayjs().startOf('month').format('YYYY-MM-DD');
    const allCustomers = await this.customersRepo.findAllActive();
    const customers = opts.onlyCustomerIds
      ? allCustomers.filter((c: any) => opts.onlyCustomerIds!.includes(c.id))
      : allCustomers;

    let created = 0;
    let skipped = 0;

    for (const customer of customers as any[]) {
      if (!customer.monthlyValue || Number(customer.monthlyValue) <= 0) {
        skipped++;
        continue;
      }
      const existing = await this.repo.findExisting(customer.id, competencia);
      if (existing) {
        skipped++;
        continue;
      }

      const valorCents = Math.round(Number(customer.monthlyValue) * 100);
      const baseVencimento = customer.nextPaymentDate
        ? dayjs(customer.nextPaymentDate)
        : dayjs(competencia).endOf('month');
      const vencimento = baseVencimento.format('YYYY-MM-DD');

      const charge = await this.repo.create({
        customerId: customer.id,
        competencia,
        valorCents,
        vencimento,
        status: MonthlyChargeStatus.PENDING,
      });

      // Atualiza nextPaymentDate do cliente para o próximo mês
      customer.nextPaymentDate = dayjs(vencimento).add(1, 'month').format('YYYY-MM-DD');
      await this.customersRepo.save(customer);

      this.eventos.emit('monthly-charge.created', { charge, customer });
      created++;
    }

    this.logger.log(`Mensalidades geradas: ${created} criadas, ${skipped} puladas (competência ${competencia})`);
    return { created, skipped };
  }

  /**
   * Listener: ao receber boleto.paid, marca a mensalidade como paga e dispara NFSe (se configurado).
   */
  async handleBoletoPaid(boleto: Boleto): Promise<void> {
    if (!boleto.monthlyChargeId) return;
    const charge = await this.repo.findById(boleto.monthlyChargeId);
    if (!charge) return;
    if (charge.status === MonthlyChargeStatus.PAID) return;

    charge.status = MonthlyChargeStatus.PAID;
    charge.paidAt = boleto.paidAt || new Date().toISOString().slice(0, 10);
    await this.repo.save(charge);

    this.eventos.emit('monthly-charge.paid', { charge, boleto });

    // Auto-emissão de NFSe se configurado
    const cfg = this.integrations.getOne('focus-nfe');
    if (cfg.automaticoNoPagamento) {
      try {
        await this.issueNfseForCharge(charge.id);
      } catch (e: any) {
        this.logger.error(`Falha NFSe automática: ${e?.message}`);
      }
    }
  }

  /**
   * Emite NFSe para uma mensalidade (vinculando à NfseEntity).
   */
  async issueNfseForCharge(chargeId: string): Promise<any> {
    const charge = await this.repo.findById(chargeId);
    if (!charge) throw new NotFoundException('Mensalidade não encontrada');
    if (!charge.customer) throw new BadRequestException('Mensalidade sem cliente vinculado');
    if (!charge.customer.cpfOrCnpj) throw new BadRequestException('Cliente sem CPF/CNPJ');

    const customer = charge.customer;
    const competenciaStr = dayjs(charge.competencia).format('MM/YYYY');

    const focusCfg = this.integrations.getOne('focus-nfe');
    // usamos uma chamada direta ao FocusNfeService com payload construído aqui para evitar dependência circular

    const record = await this.focusNfe.emitir(
      {
        ref: `${focusCfg.refPadrao}-mc-${charge.id}`,
        data_emissao: new Date().toISOString().slice(0, 10),
        data_competencia: charge.competencia,
        tomador: {
          cpf_cnpj: (customer.cpfOrCnpj || '').replace(/\D/g, ''),
          razao_social: customer.name,
          email: customer.email,
        },
        servico: {
          valor_servicos: charge.valorCents / 100,
          descricao: `Mensalidade ${competenciaStr}`,
          aliquota: 5,
          iss_retido: false,
        },
      } as any,
      { monthlyChargeId: charge.id },
    );

    if (record.status === 'authorized') {
      charge.nfseId = record.id;
      charge.status = MonthlyChargeStatus.NFSE_ISSUED;
      await this.repo.save(charge);
      this.eventos.emit('nfse.authorized', { nfse: record, monthlyCharge: charge });
    }

    return record;
  }

  /**
   * Listener: ao receber invoice.authorized (NFSe) ou nfse.authorized, vincula à mensalidade.
   */
  async handleNfseAuthorized(payload: { nfse: any; monthlyCharge?: MonthlyCharge; invoice?: any }): Promise<void> {
    const mc = payload.monthlyCharge;
    if (!mc) return;
    if (payload.nfse?.id) {
      mc.nfseId = payload.nfse.id;
      mc.status = MonthlyChargeStatus.NFSE_ISSUED;
      await this.repo.save(mc);
    }
  }

  async findAll(opts: Parameters<MonthlyChargesRepository['findAll']>[0] = {}) {
    return this.repo.findAll(opts);
  }

  async findOne(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException('Mensalidade não encontrada');
    return c;
  }

  async findOverdue() {
    return this.repo.findOverdue(dayjs().format('YYYY-MM-DD'));
  }

  async markAsPaid(id: string): Promise<MonthlyCharge> {
    const c = await this.findOne(id);
    if (c.status === MonthlyChargeStatus.PAID) return c;
    c.status = MonthlyChargeStatus.PAID;
    c.paidAt = new Date().toISOString().slice(0, 10);
    await this.repo.save(c);
    this.eventos.emit('monthly-charge.paid', { charge: c });
    return c;
  }

  async cancel(id: string): Promise<MonthlyCharge> {
    const c = await this.findOne(id);
    c.status = MonthlyChargeStatus.CANCELLED;
    await this.repo.save(c);
    return c;
  }

  async issueBoletoForCharge(chargeId: string): Promise<Boleto> {
    return this.boletosService.issue({ monthlyChargeId: chargeId });
  }

  /**
   * Cron diário: gera mensalidades do dia 1 e marca overdue.
   * Executa às 06:07 (offset de minutos) todo dia.
   */
  @Cron('7 6 * * *', { name: 'monthly-charge-daily' })
  async dailyJob() {
    this.logger.log('⏰ dailyJob: gerando mensalidades e atualizando inadimplência');
    try {
      // Marca overdue antes de gerar (para o mês corrente, se hoje > vencimento)
      const overdue = await this.repo.findOverdue(dayjs().format('YYYY-MM-DD'));
      for (const c of overdue) {
        if (c.status !== MonthlyChargeStatus.OVERDUE) {
          c.status = MonthlyChargeStatus.OVERDUE;
          await this.repo.save(c);
        }
      }

      // Gera mensalidades do mês atual (somente no dia 1, para evitar duplicar)
      const today = dayjs();
      if (today.date() === 1) {
        await this.generate();
      }
    } catch (e: any) {
      this.logger.error(`dailyJob falhou: ${e?.message}`);
    }
  }
}
