import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { MonthlyChargesService } from '../monthly-charges.service';
import { Boleto } from '../../boletos/entities/boleto.entity';
import { EmailService } from '../../../shared/services/email.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';

@Injectable()
export class MonthlyChargeListener {
  private readonly logger = new Logger(MonthlyChargeListener.name);

  constructor(
    private service: MonthlyChargesService,
    private email: EmailService,
    private whatsapp: WhatsappService,
  ) {}

  @OnEvent('boleto.paid')
  async handleBoletoPaid(payload: { boleto: Boleto }) {
    try {
      await this.service.handleBoletoPaid(payload.boleto);
    } catch (e: any) {
      this.logger.error(`Falha em handleBoletoPaid: ${e?.message}`);
    }
  }

  @OnEvent('monthly-charge.paid')
  async handlePaid(payload: { charge: any; boleto?: Boleto }) {
    const { charge, boleto } = payload;
    if (!charge?.customer) return;
    const customer = charge.customer;
    const competencia = dayjs(charge.competencia).format('MM/YYYY');

    this.logger.log(`💸 monthly-charge.paid → enviando confirmação para ${customer.name}`);

    const variables = {
      cliente_nome: customer.name,
      competencia,
      valor_pago: ((boleto?.paidAmountCents ?? charge.valorCents) / 100).toFixed(2).replace('.', ','),
      data_pagamento: dayjs(charge.paidAt || new Date()).format('DD/MM/YYYY'),
      nfse_link: 'enviada por email',
    };

    if (customer.phone) {
      try {
        await this.whatsapp.sendTemplate({
          phone: customer.phone,
          templateKey: 'pagamento_confirmado',
          variables,
          customerId: customer.id,
          monthlyChargeId: charge.id,
        });
      } catch (e: any) {
        this.logger.warn(`WhatsApp pagamento_confirmado falhou: ${e?.message}`);
      }
    }
    if (customer.email) {
      try {
        await this.email.sendCustom({
          to: customer.email,
          subject: `Pagamento confirmado - ${competencia} - Mont System`,
          html: `
            <h2>Olá, ${customer.name}!</h2>
            <p>Recebemos o pagamento da sua mensalidade de <strong>${competencia}</strong>.</p>
            <p>Valor: <strong>R$ ${variables.valor_pago}</strong></p>
            <p>Data: <strong>${variables.data_pagamento}</strong></p>
            <p style="color:#666; font-size:12px;">Obrigado pela pontualidade!</p>
          `,
        });
      } catch (e: any) {
        this.logger.warn(`Email pagamento_confirmado falhou: ${e?.message}`);
      }
    }
  }

  @OnEvent('monthly-charge.created')
  async handleCreated(payload: { charge: any; customer: any }) {
    this.logger.log(`📅 monthly-charge.created → ${payload.customer.name} competência ${dayjs(payload.charge.competencia).format('MM/YYYY')}`);
  }
}
