import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import dayjs from 'dayjs';
import { Boleto } from '../entities/boleto.entity';
import { EmailService } from '../../../shared/services/email.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { IntegrationsStorage } from '../../integrations/integrations-storage';

@Injectable()
export class BoletoListener {
  private readonly logger = new Logger(BoletoListener.name);

  constructor(
    private email: EmailService,
    private whatsapp: WhatsappService,
    private integrations: IntegrationsStorage,
  ) {}

  @OnEvent('boleto.issued')
  async handleBoletoIssued(payload: { boleto: Boleto; customer?: any; monthlyCharge?: any }) {
    const { boleto, customer, monthlyCharge } = payload;
    if (!customer) {
      this.logger.warn(`boleto.issued sem customer; pulando (id=${boleto.id})`);
      return;
    }
    this.logger.log(`📨 boleto.issued → enviando email e WhatsApp para ${customer.name} (boleto ${boleto.nossoNumero})`);

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
      } catch (e: any) {
        this.logger.warn(`Falha WhatsApp boleto.issued: ${e?.message}`);
      }
    }

    // Email
    if (customer.email) {
      try {
        await this.email.sendCustom({
          to: customer.email,
          subject: `Boleto disponível - ${competencia} - Mont System`,
          html: this.emailBoletoTemplate(boleto, customer, competencia),
          attachments: boleto.localPdfPath
            ? [{ filename: `boleto-${boleto.nossoNumero}.pdf`, path: boleto.localPdfPath }]
            : [],
        });
      } catch (e: any) {
        this.logger.warn(`Falha email boleto.issued: ${e?.message}`);
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

  private emailBoletoTemplate(boleto: Boleto, customer: any, competencia: string): string {
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Boleto disponível</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2 style="color: #1a73e8;">Olá, ${customer.name}!</h2>
    <p>Seu boleto da mensalidade de <strong>${competencia}</strong> está disponível.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Valor</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">R$ ${boleto.valor.toFixed(2).replace('.', ',')}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Vencimento</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${dayjs(boleto.vencimento).format('DD/MM/YYYY')}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Nosso número</strong></td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${boleto.nossoNumero}</td></tr>
      <tr><td style="padding: 8px;"><strong>Linha digitável</strong></td>
          <td style="padding: 8px; font-family: monospace;">${boleto.linhaDigitavel || ''}</td></tr>
    </table>

    <p>O PDF do boleto está anexado a este email. Você também pode pagar pelo app do seu banco usando a linha digitável acima.</p>
    <p style="color: #666; font-size: 12px;">Em caso de dúvidas, entre em contato conosco. Obrigado!</p>
  </div>
</body>
</html>`;
  }
}
