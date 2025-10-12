import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../../../shared/services/email.service';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class InvoiceEmailListener {
  constructor(private emailService: EmailService) {}

  @OnEvent('invoice.authorized')
  async handleInvoiceAuthorized(invoiceOrPayload: any) {
    const invoice: Invoice | undefined = this.extractInvoice(invoiceOrPayload);
    if (!invoice) {
      console.warn('Evento invoice.authorized recebido sem invoice válido');
      return;
    }

    console.log(`📧 Enviando email para NFe autorizada: ${invoice.number}/${invoice.series}`);
    try {
      const emailSent = await this.emailService.sendInvoiceEmail(invoice);
      if (emailSent) {
        console.log(`✅ Email da NFe ${invoice.number} enviado com sucesso para ${invoice.clientEmail}`);
      } else {
        console.log(`⚠️ Email da NFe ${invoice.number} não pôde ser enviado`);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao enviar email da NFe ${invoice.number}:`, error.message);
    }
  }

  @OnEvent('invoice.rejected')
  async handleInvoiceRejected(payload: any) {
    const invoice: Invoice | undefined = this.extractInvoice(payload);
    const reason = payload?.reason || payload?.rejectionReason || payload?.sefazResponse || 'Motivo não informado';

    if (!invoice) {
      console.warn('Evento invoice.rejected recebido sem invoice válido. Motivo:', reason);
      return;
    }

    console.log(`📧 NFe ${invoice.number} foi rejeitada: ${reason}`);
    // TODO: Implementar notificação por email sobre rejeição (administrativo)
  }

  @OnEvent('invoice.cancelled')
  async handleInvoiceCancelled(payload: any) {
    const invoice: Invoice | undefined = this.extractInvoice(payload);
    const justificativa = payload?.justificativa || payload?.rejectionReason || 'Justificativa não informada';

    if (!invoice) {
      console.warn('Evento invoice.cancelled recebido sem invoice válido. Justificativa:', justificativa);
      return;
    }

    console.log(`📧 NFe ${invoice.number} foi cancelada: ${justificativa}`);
    // TODO: Implementar notificação por email sobre cancelamento
  }

  private extractInvoice(payload: any): Invoice | undefined {
    if (!payload) return undefined;
    if (payload.invoice) return payload.invoice as Invoice;
    // Caso o próprio invoice tenha sido passado diretamente
    if (payload.number && payload.series) return payload as Invoice;
    return undefined;
  }
}