import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { Boleto } from '../entities/boleto.entity';
import { EmailService } from '../../../shared/services/email.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { IntegrationsStorage } from '../../integrations/integrations-storage';
import { renderBoletoDisponivel } from '../../../shared/templates/email/email-templates';
import { BillingNotificationsRepository } from '../../billing-notifications/billing-notifications.repository';
import { BillingNotificationKind } from '../../billing-notifications/entities/billing-notification.entity';

@Injectable()
export class BoletoListener {
  private readonly logger = new Logger(BoletoListener.name);

  constructor(
    private email: EmailService,
    private whatsapp: WhatsappService,
    private integrations: IntegrationsStorage,
    private billingNotifRepo: BillingNotificationsRepository,
  ) {}

  @OnEvent('boleto.issued')
  async handleBoletoIssued(payload: { boleto: Boleto; customer?: any; monthlyCharge?: any }) {
    const { boleto, customer, monthlyCharge } = payload;
    if (!customer) {
      this.logger.warn(`boleto.issued sem customer; pulando (id=${boleto.id})`);
      return;
    }

    const competencia = monthlyCharge?.competencia
      ? dayjs(monthlyCharge.competencia).format('MM/YYYY')
      : dayjs(boleto.vencimento).format('MM/YYYY');

    const variables = {
      cliente_nome: customer.name,
      competencia,
      valor: boleto.valor.toFixed(2).replace('.', ','),
      vencimento: dayjs(boleto.vencimento).format('DD/MM/YYYY'),
      linha_digitavel: boleto.linhaDigitavel || '(enviada por email)',
    };

    let whatsappSent = false;
    let emailSent = false;
    let lastError: string | undefined;

    // WhatsApp
    if (customer.phone) {
      try {
        await this.whatsapp.sendTemplate({
          phone: customer.phone,
          templateKey: 'boleto_disponivel',
          variables,
          customerId: customer.id,
          monthlyChargeId: monthlyCharge?.id,
          mediaUrl: boleto.urlPdf,
          mediaCaption: `Boleto ${competencia} - R$ ${variables.valor}`,
        });
        whatsappSent = true;
      } catch (e: any) {
        lastError = `whatsapp: ${e?.message}`;
        this.logger.warn(`Falha WhatsApp boleto.issued: ${e?.message}`);
      }
    }

    // Email
    if (customer.email) {
      try {
        await this.email.sendCustom({
          to: customer.email,
          subject: `Boleto disponível - ${competencia} - Mont System`,
          html: renderBoletoDisponivel(boleto, customer, competencia),
          attachments: boleto.localPdfPath
            ? [{ filename: `boleto-${boleto.nossoNumero}.pdf`, path: boleto.localPdfPath }]
            : [],
        });
        emailSent = true;
      } catch (e: any) {
        lastError = lastError
          ? `${lastError}; email: ${e?.message}`
          : `email: ${e?.message}`;
        this.logger.warn(`Falha email boleto.issued: ${e?.message}`);
      }
    }

    // Registra notificação para idempotência (5d antes, apenas para mensalidades)
    if (monthlyCharge?.id && (whatsappSent || emailSent)) {
      try {
        await this.billingNotifRepo.create({
          monthlyChargeId: monthlyCharge.id,
          customerId: customer.id,
          kind: BillingNotificationKind.BOLETO_PRE_EMITTED,
          whatsappSent,
          emailSent,
          errorMessage: lastError,
        });
      } catch (e: any) {
        // Se já existe (UNIQUE conflict), tudo bem — só loga
        this.logger.debug(`BillingNotification BOLETO_PRE_EMITTED já existe: ${e?.message}`);
      }
    }
  }

  @OnEvent('boleto.paid')
  async handleBoletoPaid(payload: { boleto: Boleto }) {
    const { boleto } = payload;
    this.logger.log(`💰 boleto.paid → ${boleto.nossoNumero} (valor pago: R$ ${boleto.paidAmount})`);

    // Emite evento adicional para o fluxo de mensalidades (MonthlyChargesService escuta)
    // Quem cuida da NFSe automática é o MonthlyChargesService.
  }
}
