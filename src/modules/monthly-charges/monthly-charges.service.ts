import { Injectable, Logger, NotFoundException, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { MonthlyChargesRepository } from './monthly-charges.repository';
import { CustomersRepository } from '../customers/customers.repository';
import { MonthlyCharge, MonthlyChargeStatus } from './entities/monthly-charge.entity';
import { BoletosService } from '../boletos/boletos.service';
import { IntegrationsStorage } from '../integrations/integrations-storage';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../../shared/services/email.service';
import { BillingNotificationsRepository } from '../billing-notifications/billing-notifications.repository';
import { BillingNotificationKind } from '../billing-notifications/entities/billing-notification.entity';
import {
  renderBoletoVencimentoHoje,
  renderAvisoDesativacao,
} from '../../shared/templates/email/email-templates';
import { Boleto } from '../boletos/entities/boleto.entity';
import { InvoicesService } from '../invoices/invoices.service';
import { SalesRepository } from '../sales/sales.repository';

@Injectable()
export class MonthlyChargesService {
  private readonly logger = new Logger(MonthlyChargesService.name);

  constructor(
    private repo: MonthlyChargesRepository,
    private customersRepo: CustomersRepository,
    private eventos: EventEmitter2,
    private boletosService: BoletosService,
    private integrations: IntegrationsStorage,
    private whatsapp: WhatsappService,
    private email: EmailService,
    private billingNotifRepo: BillingNotificationsRepository,
    // forwardRef: ciclo com InvoicesModule. InvoicesService cria Invoice
    // a partir da mensalidade; MonthlyChargesService dispara a criação
    // após pagamento do boleto.
    @Inject(forwardRef(() => InvoicesService))
    private invoicesService: InvoicesService,
    // Para o listener de mensalidade paga que dispara sale.paid quando
    // todos os charges da venda estão pagos.
    private salesRepo: SalesRepository,
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
      const next = customer.nextPaymentDate ? dayjs(customer.nextPaymentDate) : null;
      const competenciaMonth = dayjs(competencia);

      // Só gera se o próximo pagamento já caiu neste mês de competência
      // (ou está atrasado). Evita criar cobrança no dia 1 quando o vencimento é dia 10.
      if (next && next.isAfter(competenciaMonth.endOf('month'), 'day')) {
        skipped++;
        continue;
      }

      const billingDay = next ? next.date() : competenciaMonth.daysInMonth();
      const vencimento = competenciaMonth
        .date(Math.min(billingDay, competenciaMonth.daysInMonth()))
        .format('YYYY-MM-DD');

      // Se o próximo pagamento ainda está no futuro (após hoje), não gera ainda
      if (dayjs(vencimento).isAfter(dayjs(), 'day') && next && next.isAfter(dayjs(), 'day')) {
        skipped++;
        continue;
      }

      const charge = await this.repo.create({
        customerId: customer.id,
        competencia,
        valorCents,
        vencimento,
        status: MonthlyChargeStatus.PENDING,
      });

      // Mantém o mesmo dia do mês no próximo ciclo
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
   * Também verifica se a venda inteira está quitada e emite `sale.paid` se for o caso.
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

    // Se a mensalidade pertence a uma venda, verifica se a venda inteira
    // está quitada e emite `sale.paid` para acionar a emissão automática
    // de NFSe no nível da venda (listener no InvoicesModule).
    if (charge.saleId) {
      await this.maybeEmitSalePaid(charge.saleId);
    }
  }

  /**
   * Verifica se todas as mensalidades de uma venda estão pagas e, em caso
   * afirmativo, marca a venda como paga e emite `sale.paid`. O listener em
   * InvoicesModule cuida da emissão da NFSe consolidada da venda.
   */
  private async maybeEmitSalePaid(saleId: string): Promise<void> {
    const sale = await this.salesRepo.findOne(saleId);
    if (!sale) return;
    // Idempotência: se a venda já está paga, não faz nada.
    if (sale.status === 'PAID') return;

    const saleCharges = await this.repo.findBySaleId(saleId);
    if (saleCharges.length === 0) return;

    const allPaid = saleCharges.every(
      (c) => c.status === MonthlyChargeStatus.PAID || c.status === MonthlyChargeStatus.NFSE_ISSUED,
    );
    if (!allPaid) return;

    // Marca a venda como paga e emite o evento. O listener em InvoicesModule
    // (via InvoiceAutoListener) dispara InvoicesService.createFromSale.
    (sale as any).status = 'PAID';
    (sale as any).paidAt = new Date().toISOString().slice(0, 10);
    await this.salesRepo.save(sale as any);

    this.eventos.emit('sale.paid', { sale });
  }

  /**
   * Emite NFSe para uma mensalidade (vinculando à NfseEntity).
   *
   * Caminho unificado: cria uma `Invoice` (DRAFT) com `monthlyChargeId` e
   * `saleId` populados, e chama `InvoicesService.sendNfse` que escreve tanto
   * em `invoices` quanto em `nfse`. `MonthlyCharge.nfseId` é atualizado
   * dentro do InvoicesService para manter compatibilidade.
   */
  async issueNfseForCharge(chargeId: string): Promise<any> {
    const result = await this.invoicesService.createFromMonthlyCharge(chargeId);
    // Mantém compatibilidade com listeners existentes que escutam `nfse.authorized`
    // recebendo o `MonthlyCharge`. O Invoice tem `monthlyChargeId` que serve de link.
    if (result.invoice?.id) {
      const charge = await this.repo.findById(chargeId);
      if (charge) {
        this.eventos.emit('nfse.authorized', {
          invoice: result.invoice,
          monthlyCharge: charge,
        });
      }
    }
    return result;
  }

  /**
   * Listener: ao receber invoice.authorized (NFSe) ou nfse.authorized, vincula à mensalidade.
   * O envio de email ao cliente é feito pelo NfseEmailListener (módulo billing-notifications).
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

    // Verifica se a venda inteira está quitada e dispara sale.paid
    if (c.saleId) {
      await this.maybeEmitSalePaid(c.saleId);
    }
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

  // ============================================================
  //  Jobs automáticos (5d antes, vencimento, 5d após)
  // ============================================================

  /**
   * Emite boleto automaticamente para mensalidades com vencimento em 5 dias.
   * O envio de WhatsApp + email é feito pelo BoletoListener existente
   * (evento `boleto.issued` → template `boleto_disponivel`).
   */
  async issueBoletosAnticipated(): Promise<{ processed: number; issued: number; skipped: number }> {
    const targetDate = dayjs().add(5, 'day').format('YYYY-MM-DD');
    const charges = await this.repo.findByVencimentoAndStatuses(targetDate, [
      MonthlyChargeStatus.PENDING,
    ]);

    let issued = 0;
    let skipped = 0;
    for (const charge of charges) {
      try {
        // Idempotência — não emite boleto duas vezes para a mesma mensalidade
        if (charge.boletoId) {
          skipped++;
          continue;
        }
        await this.boletosService.issue({ monthlyChargeId: charge.id });
        issued++;
        this.logger.log(
          `🧾 Boleto emitido para mensalidade ${charge.id} (cliente ${charge.customer?.name}, vencimento ${targetDate})`,
        );
      } catch (e: any) {
        this.logger.error(`Falha ao emitir boleto antecipado (mensalidade ${charge.id}): ${e?.message}`);
      }
    }
    this.logger.log(
      `issueBoletosAnticipated: ${charges.length} encontradas, ${issued} emitidas, ${skipped} puladas (data alvo ${targetDate})`,
    );
    return { processed: charges.length, issued, skipped };
  }

  /**
   * Notifica o cliente no dia do vencimento do boleto.
   * Envia WhatsApp (template `boleto_vencimento_hoje`) + email.
   * Idempotente via `billing_notifications`.
   */
  async notifyDueDate(): Promise<{ processed: number; notified: number }> {
    const today = dayjs().format('YYYY-MM-DD');
    const charges = await this.repo.findByVencimentoAndStatuses(today, [
      MonthlyChargeStatus.BOLETO_ISSUED,
      MonthlyChargeStatus.OVERDUE,
      MonthlyChargeStatus.PENDING, // cobre casos sem boleto (à vista no dia)
    ]);

    let notified = 0;
    for (const charge of charges) {
      try {
        const existing = await this.billingNotifRepo.findExisting(
          charge.id,
          BillingNotificationKind.DUE_DATE,
        );
        if (existing) continue;
        if (!charge.customer) continue;

        const customer = charge.customer;
        const competencia = dayjs(charge.competencia).format('MM/YYYY');
        const valor = (charge.valorCents / 100).toFixed(2).replace('.', ',');
        const linhaDigitavel = charge.boleto?.linhaDigitavel || '(enviada por email)';
        const vencimento = dayjs(charge.vencimento).format('DD/MM/YYYY');

        let whatsappSent = false;
        let emailSent = false;
        let lastError: string | undefined;

        if (customer.phone) {
          try {
            await this.whatsapp.sendTemplate({
              phone: customer.phone,
              templateKey: 'boleto_vencimento_hoje',
              variables: {
                cliente_nome: customer.name,
                competencia,
                valor,
                linha_digitavel: linhaDigitavel,
              },
              customerId: customer.id,
              monthlyChargeId: charge.id,
            });
            whatsappSent = true;
          } catch (e: any) {
            lastError = `whatsapp: ${e?.message}`;
            this.logger.warn(`WhatsApp vencimento falhou (${charge.id}): ${e?.message}`);
          }
        }

        if (customer.email) {
          try {
            // Usa o boleto se existir; senão gera HTML simples com os dados da mensalidade
            const boletoFake = {
              valor: charge.valorCents / 100,
              vencimento: charge.vencimento,
              linhaDigitavel: charge.boleto?.linhaDigitavel || '',
              nossoNumero: charge.boleto?.nossoNumero || '',
            } as any;
            await this.email.sendCustom({
              to: customer.email,
              subject: `Vencimento hoje — ${competencia} — Mont System`,
              html: renderBoletoVencimentoHoje(boletoFake, customer, competencia),
            });
            emailSent = true;
          } catch (e: any) {
            lastError = lastError
              ? `${lastError}; email: ${e?.message}`
              : `email: ${e?.message}`;
            this.logger.warn(`Email vencimento falhou (${charge.id}): ${e?.message}`);
          }
        }

        // Só registra notificação se pelo menos um canal funcionou
        if (whatsappSent || emailSent) {
          await this.billingNotifRepo.create({
            monthlyChargeId: charge.id,
            customerId: customer.id,
            kind: BillingNotificationKind.DUE_DATE,
            whatsappSent,
            emailSent,
            errorMessage: lastError,
          });
          notified++;
        }
      } catch (e: any) {
        this.logger.error(`Falha notifyDueDate (mensalidade ${charge.id}): ${e?.message}`);
      }
    }

    this.logger.log(
      `notifyDueDate: ${charges.length} encontradas, ${notified} notificadas (data ${today})`,
    );
    return { processed: charges.length, notified };
  }

  /**
   * Avisa o cliente 5 dias após o vencimento com tom de "desativação".
   * Apenas envia a mensagem — NÃO altera `customer.active` (decisão do projeto).
   * Idempotente via `billing_notifications`.
   */
  async notifyOverdueWarning(): Promise<{ processed: number; notified: number }> {
    const targetDate = dayjs().subtract(5, 'day').format('YYYY-MM-DD');
    const charges = await this.repo.findByVencimentoAndStatuses(targetDate, [
      MonthlyChargeStatus.OVERDUE,
      MonthlyChargeStatus.BOLETO_ISSUED,
      MonthlyChargeStatus.PENDING,
    ]);

    let notified = 0;
    for (const charge of charges) {
      try {
        const existing = await this.billingNotifRepo.findExisting(
          charge.id,
          BillingNotificationKind.OVERDUE_5_DAYS,
        );
        if (existing) continue;
        if (!charge.customer) continue;

        const customer = charge.customer;
        const competencia = dayjs(charge.competencia).format('MM/YYYY');
        const valor = (charge.valorCents / 100).toFixed(2).replace('.', ',');
        const vencimento = dayjs(charge.vencimento).format('DD/MM/YYYY');

        let whatsappSent = false;
        let emailSent = false;
        let lastError: string | undefined;

        if (customer.phone) {
          try {
            await this.whatsapp.sendTemplate({
              phone: customer.phone,
              templateKey: 'aviso_desativacao_5_dias',
              variables: {
                cliente_nome: customer.name,
                competencia,
                valor,
                vencimento,
              },
              customerId: customer.id,
              monthlyChargeId: charge.id,
            });
            whatsappSent = true;
          } catch (e: any) {
            lastError = `whatsapp: ${e?.message}`;
            this.logger.warn(`WhatsApp desativação falhou (${charge.id}): ${e?.message}`);
          }
        }

        if (customer.email) {
          try {
            await this.email.sendCustom({
              to: customer.email,
              subject: `⚠️ Aviso importante — mensalidade ${competencia} em atraso — Mont System`,
              html: renderAvisoDesativacao(charge, customer, charge.boleto),
            });
            emailSent = true;
          } catch (e: any) {
            lastError = lastError
              ? `${lastError}; email: ${e?.message}`
              : `email: ${e?.message}`;
            this.logger.warn(`Email desativação falhou (${charge.id}): ${e?.message}`);
          }
        }

        if (whatsappSent || emailSent) {
          await this.billingNotifRepo.create({
            monthlyChargeId: charge.id,
            customerId: customer.id,
            kind: BillingNotificationKind.OVERDUE_5_DAYS,
            whatsappSent,
            emailSent,
            errorMessage: lastError,
          });
          notified++;
        }
      } catch (e: any) {
        this.logger.error(`Falha notifyOverdueWarning (mensalidade ${charge.id}): ${e?.message}`);
      }
    }

    this.logger.log(
      `notifyOverdueWarning: ${charges.length} encontradas, ${notified} notificadas (data alvo ${targetDate})`,
    );
    return { processed: charges.length, notified };
  }

  /**
   * Cron diário: cobre toda a linha do tempo da cobrança mensal.
   * - 06:07: marca inadimplência, gera mensalidades do dia 1, emite
   *   boleto antecipado, notifica vencimento e aviso de desativação.
   */
  @Cron('7 6 * * *', { name: 'monthly-charge-daily' })
  async dailyJob() {
    this.logger.log('⏰ dailyJob: iniciando linha do tempo de cobrança mensal');
    try {
      // 1. Marca inadimplência (mensalidades vencidas hoje ou antes)
      const overdue = await this.repo.findOverdue(dayjs().format('YYYY-MM-DD'));
      for (const c of overdue) {
        if (c.status !== MonthlyChargeStatus.OVERDUE) {
          c.status = MonthlyChargeStatus.OVERDUE;
          await this.repo.save(c);
        }
      }

      // 2. Gera mensalidades do mês atual somente no dia 1 (evita duplicar)
      const today = dayjs();
      if (today.date() === 1) {
        await this.generate();
      }

      // 3. Emite boletos 5 dias antes do vencimento
      await this.issueBoletosAnticipated();

      // 4. Notifica vencimento hoje
      await this.notifyDueDate();

      // 5. Avisa 5 dias em atraso (tom de desativação)
      await this.notifyOverdueWarning();

      this.logger.log('⏰ dailyJob: concluído');
    } catch (e: any) {
      this.logger.error(`dailyJob falhou: ${e?.message}`);
    }
  }
}
