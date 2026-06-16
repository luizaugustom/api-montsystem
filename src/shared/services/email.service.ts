import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ResendService } from './resend.service';
import { Invoice } from '../../modules/invoices/entities/invoice.entity';
import { NFeConfigService } from '../../modules/nfe/services/nfe-config.service';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; path: string }>;
}

/**
 * EmailService é a fachada usada pelo restante da aplicação. Internamente delega
 * para ResendService (substitui o antigo nodemailer/SMTP).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private resend: ResendService,
    private nfeConfigService: NFeConfigService,
  ) {}

  async sendInvoiceEmail(invoice: Invoice): Promise<boolean> {
    try {
      if (!invoice.clientEmail) {
        this.logger.warn(`Cliente ${invoice.clientName} não possui email cadastrado`);
        return false;
      }

      const config = this.nfeConfigService.getConfig();
      const attachments: Array<{ filename: string; path: string }> = [];

      // Adicionar arquivo XML se existir
      if (invoice.xmlFilePath) {
        const xmlPath = path.join(process.cwd(), 'storage', 'nfe', 'xml', invoice.xmlFilePath);
        try {
          await fs.access(xmlPath);
          attachments.push({ filename: `NFe-${invoice.number}.xml`, path: xmlPath });
        } catch {
          this.logger.warn(`Arquivo XML não encontrado: ${xmlPath}`);
        }
      }

      // Adicionar arquivo PDF se existir
      if (invoice.pdfFilePath) {
        const pdfPath = path.join(process.cwd(), 'storage', 'nfe', 'pdf', invoice.pdfFilePath);
        try {
          await fs.access(pdfPath);
          attachments.push({ filename: `NFe-${invoice.number}.pdf`, path: pdfPath });
        } catch {
          this.logger.warn(`Arquivo PDF não encontrado: ${pdfPath}`);
        }
      }

      const emailHtml = this.generateInvoiceEmailTemplate(invoice);

      const res = await this.resend.sendWithFileAttachment({
        to: invoice.clientEmail,
        subject: `Nota Fiscal Eletrônica - ${invoice.number}/${invoice.series} - ${config.company.name}`,
        html: emailHtml,
        attachments,
      });

      if (res.ok) {
        this.logger.log(`Email da NFe ${invoice.number} enviado para ${invoice.clientEmail}`);
        return true;
      }
      this.logger.warn(`Falha ao enviar email da NFe ${invoice.number}: ${res.error}`);
      return false;
    } catch (error: any) {
      this.logger.error(`Erro ao enviar email da NFe ${invoice.number}: ${error.message}`);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const res = await this.resend.sendWithFileAttachment({
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments || [],
    });
    return res.ok;
  }

  /**
   * Envia email genérico (template livre) com texto/HTML e anexos opcionais via path.
   */
  async sendCustom(opts: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    attachments?: Array<{ filename: string; path: string }>;
  }): Promise<boolean> {
    if (opts.attachments && opts.attachments.length > 0) {
      const res = await this.resend.sendWithFileAttachment({
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments,
      });
      return res.ok;
    }
    const res = await this.resend.send({
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return res.ok;
  }

  private generateInvoiceEmailTemplate(invoice: Invoice): string {
    const config = this.nfeConfigService.getConfig();
    const isHomologacao = config.environment === 'homologacao';

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nota Fiscal Eletrônica</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #007bff; }
        .nfe-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .nfe-number { font-size: 20px; font-weight: bold; color: #28a745; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; font-size: 12px; color: #6c757d; }
        .btn { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-name">${config.company.name}</div>
            <div>CNPJ: ${config.company.cnpj}</div>
            <div>${config.company.address.street}, ${config.company.address.number}</div>
            <div>${config.company.address.city} - ${config.company.address.state}</div>
            <div>CEP: ${config.company.address.cep}</div>
        </div>

        ${isHomologacao ? `
        <div class="warning">
            <strong>⚠️ ATENÇÃO:</strong> Esta é uma nota fiscal emitida em ambiente de homologação e não possui valor fiscal.
        </div>
        ` : ''}

        <h2>Nota Fiscal Eletrônica</h2>

        <div class="nfe-info">
            <div class="nfe-number">NFe ${invoice.number}/${invoice.series}</div>
            <div><strong>Chave de Acesso:</strong> ${invoice.accessKey || 'Gerando...'}</div>
            <div><strong>Data de Emissão:</strong> ${new Date(invoice.issueDate).toLocaleDateString('pt-BR')}</div>
            <div><strong>Protocolo:</strong> ${invoice.protocolNumber || 'Aguardando autorização'}</div>
        </div>

        <h3>Destinatário</h3>
        <table>
            <tr><th>Nome:</th><td>${invoice.clientName}</td></tr>
            <tr><th>Documento:</th><td>${invoice.clientDocument}</td></tr>
            <tr><th>Email:</th><td>${invoice.clientEmail}</td></tr>
            ${invoice.clientAddress ? `<tr><th>Endereço:</th><td>${invoice.clientAddress}</td></tr>` : ''}
        </table>

        <h3>Dados da Nota Fiscal</h3>
        <table>
            <tr><th>Descrição:</th><td>${invoice.description}</td></tr>
            <tr><th>Valor Total:</th><td>R$ ${invoice.totalValue.toFixed(2).replace('.', ',')}</td></tr>
            ${invoice.discountValue ? `<tr><th>Desconto:</th><td>R$ ${invoice.discountValue.toFixed(2).replace('.', ',')}</td></tr>` : ''}
            ${invoice.taxValue ? `<tr><th>Impostos:</th><td>R$ ${invoice.taxValue.toFixed(2).replace('.', ',')}</td></tr>` : ''}
        </table>

        <p>Esta nota fiscal foi gerada automaticamente pelo sistema <strong>${config.company.fantasy || config.company.name}</strong>.</p>

        <p>Os arquivos XML e PDF da nota fiscal estão anexados a este email. Guarde-os para seus registros contábeis.</p>

        <div class="footer">
            <p>Este email foi enviado automaticamente. Não responda a esta mensagem.</p>
            <p>Em caso de dúvidas, entre em contato conosco pelo telefone ${config.company.contact.phone} ou email ${config.company.contact.email}.</p>
            <p><small>Enviado pelo sistema Mont System - Gestão Inteligente</small></p>
        </div>
    </div>
</body>
</html>`;
  }

  async testEmailConnection(): Promise<boolean> {
    return this.resend.isConfigured();
  }

  async sendTestEmail(to: string): Promise<boolean> {
    const res = await this.resend.sendTestEmail(to);
    return res.ok;
  }
}
