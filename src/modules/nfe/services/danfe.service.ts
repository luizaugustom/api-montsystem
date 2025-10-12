import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { NFeConfigService } from './nfe-config.service';

@Injectable()
export class DanfeService {
  constructor(private readonly configService: NFeConfigService) {}

  async generateDanfe(invoice: Invoice): Promise<string> {
    const config = this.configService.getConfig();
    const storageDir = path.join(process.cwd(), 'storage', 'nfe', 'pdf');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    const fileName = `danfe-${invoice.id}.pdf`;
    const filePath = path.join(storageDir, fileName);

    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(16).text('DANFE - Documento Auxiliar da NF-e', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Ambiente: ${config.environment.toUpperCase()}   Série: ${invoice.series}   Número: ${invoice.number}`);

    doc.moveDown(0.5);
    doc.text(`Emitente: ${config.company.name} | CNPJ: ${config.company.cnpj}`);
    doc.text(`Endereço: ${config.company.address.street}, ${config.company.address.number} - ${config.company.address.neighborhood}`);
    doc.text(`${config.company.address.city} - ${config.company.address.state} - CEP: ${config.company.address.cep}`);

    doc.moveDown(0.5);
    doc.text(`Destinatário: ${invoice.clientName}`);
    doc.text(`Documento: ${invoice.clientDocument}`);
    if (invoice.clientAddress) doc.text(`Endereço: ${invoice.clientAddress}`);

    doc.moveDown(0.5);
    if (invoice.accessKey) {
      doc.text(`Chave de Acesso: ${invoice.accessKey}`);
      try {
        const dataUrl = await QRCode.toDataURL(invoice.accessKey);
        const base64 = dataUrl.split(',')[1];
        const buf = Buffer.from(base64, 'base64');
  doc.image(buf, { fit: [120, 120], align: 'left' as any });
      } catch {}
    } else {
      doc.text('Chave de Acesso: (a definir após autorização)');
    }

    doc.moveDown(1);
    doc.fontSize(12).text('Descrição dos Produtos/Serviços');
    doc.moveDown(0.25);
    doc.fontSize(10).text(invoice.description);

    doc.moveDown(1);
    const valor = (invoice.totalValueCents / 100).toFixed(2);
    const desconto = invoice.discountValueCents ? (invoice.discountValueCents / 100).toFixed(2) : '0.00';
    doc.text(`Valor Total: R$ ${valor}`);
    doc.text(`Desconto: R$ ${desconto}`);
    doc.text(`Situação: ${invoice.status}`);

    doc.end();
    await new Promise<void>((resolve) => stream.on('finish', () => resolve()));

    return fileName; // retorna apenas o nome do arquivo salvo em storage/nfe/pdf
  }
}
