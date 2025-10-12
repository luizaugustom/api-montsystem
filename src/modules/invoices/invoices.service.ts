import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesRepository } from './invoices.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { toCents } from '../../shared/utils/currency';
import { SalesRepository } from '../sales/sales.repository';
import { NFeConfigService } from '../nfe/services/nfe-config.service';
import { NFeXmlService } from '../nfe/services/nfe-xml.service';
import { NFeSignatureService } from '../nfe/services/nfe-signature.service';
import { NFeWebServiceService } from '../nfe/services/nfe-webservice.service';
import { NfseXmlService } from '../nfse/services/nfse-xml.service';
import { NfseSignatureService } from '../nfse/services/nfse-signature.service';
import { NfseWebServiceService } from '../nfse/services/nfse-webservice.service';
import { DanfeService } from '../nfe/services/danfe.service';
import { NFeData } from '../nfe/interfaces/nfe.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InvoiceItem } from './entities/invoice_item.entity';

interface CreateInvoiceData {
  number: string;
  series: string;
  type?: InvoiceType;
  issueDate: string;
  dueDate?: string;
  totalValue: number;
  taxValue?: number;
  discountValue?: number;
  clientName: string;
  clientDocument: string;
  clientEmail?: string;
  clientAddress?: string;
  description: string;
  saleId?: string;
}

interface UpdateInvoiceData {
  status?: InvoiceStatus;
  accessKey?: string;
  protocolNumber?: string;
  sefazResponse?: string;
  rejectionReason?: string;
  xmlFilePath?: string;
  pdfFilePath?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    private repo: InvoicesRepository,
    private salesRepo: SalesRepository,
    private events: EventEmitter2,
    private nfeConfigService: NFeConfigService,
    private nfeXmlService: NFeXmlService,
    private nfeSignatureService: NFeSignatureService,
    private nfeWebServiceService: NFeWebServiceService,
    private danfeService: DanfeService,
    // NFSe services
    private nfseXmlService: NfseXmlService,
    private nfseSignatureService: NfseSignatureService,
    private nfseWebServiceService: NfseWebServiceService,
  ) {}

  async create(data: CreateInvoiceData & { items?: Array<{ codigo: string; descricao: string; ncm: string; cfop: string; unidade: string; quantidade: number; valorUnitario: number; icms?: { origem: string; cst: string; aliquota?: number; valor?: number } }> }) {
    // Verificar se já existe nota fiscal com o mesmo número
    const existingInvoice = await this.repo.findByNumber(data.number);
    if (existingInvoice) {
      throw new BadRequestException(`Nota fiscal com número ${data.number} já existe`);
    }

    // Validar venda se informada
    if (data.saleId) {
      const sale = await this.salesRepo.findOne(data.saleId);
      if (!sale) {
        throw new NotFoundException(`Venda com ID ${data.saleId} não encontrada`);
      }
    }

    // Se itens informados, recalcula total
    let totalFromItems = 0;
    let itemsEntities: Partial<InvoiceItem>[] | undefined;
    if (data.items && data.items.length > 0) {
      itemsEntities = data.items.map((it) => {
        const valorTotal = it.quantidade * it.valorUnitario;
        totalFromItems += valorTotal;
        return {
          codigo: it.codigo,
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          unidade: it.unidade,
          quantidade: it.quantidade,
          valorUnitarioCents: toCents(it.valorUnitario),
          valorTotalCents: toCents(valorTotal),
          icmsOrigem: it.icms?.origem,
          icmsCst: it.icms?.cst,
          icmsAliquota: it.icms?.aliquota ?? null,
          icmsValor: it.icms?.valor ?? null,
        } as Partial<InvoiceItem>;
      });
    }

    // Converter valores para centavos
    const invoiceData: Partial<Invoice> = {
      ...data,
      totalValueCents: toCents(itemsEntities ? totalFromItems : data.totalValue),
      taxValueCents: data.taxValue ? toCents(data.taxValue) : undefined,
      discountValueCents: data.discountValue ? toCents(data.discountValue) : undefined,
      type: data.type || InvoiceType.NFE,
      status: InvoiceStatus.DRAFT,
      items: itemsEntities as any,
    };

    // Remove campos que não existem na entidade
    delete (invoiceData as any).totalValue;
    delete (invoiceData as any).taxValue;
    delete (invoiceData as any).discountValue;

  const created = await this.repo.create(invoiceData);
  const invoice = Array.isArray(created) ? created[0] : created;
  this.events.emit('invoice.created', { invoice });
  return this.transformInvoiceForResponse(invoice);
  }

  async findAll() {
    const invoices = await this.repo.findAll();
    return invoices.map(invoice => this.transformInvoiceForResponse(invoice));
  }

  async findOne(id: string) {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }
    return this.transformInvoiceForResponse(invoice);
  }

  async findBySaleId(saleId: string) {
    const invoices = await this.repo.findBySaleId(saleId);
    return invoices.map(invoice => this.transformInvoiceForResponse(invoice));
  }

  async findByStatus(status: InvoiceStatus) {
    const invoices = await this.repo.findByStatus(status);
    return invoices.map(invoice => this.transformInvoiceForResponse(invoice));
  }

  async findByDateRange(startDate: string, endDate: string) {
    const invoices = await this.repo.findByDateRange(startDate, endDate);
    return invoices.map(invoice => this.transformInvoiceForResponse(invoice));
  }

  async updateStatus(id: string, status: InvoiceStatus, additionalData?: UpdateInvoiceData) {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    const updated = await this.repo.updateStatus(id, status, additionalData);
    
    // Emitir eventos baseados no status
  this.events.emit('invoice.status.changed', { invoice: updated, oldStatus: invoice.status, newStatus: status });
    
    if (status === InvoiceStatus.AUTHORIZED) {
      this.events.emit('invoice.authorized', { invoice: updated });
    } else if (status === InvoiceStatus.CANCELLED) {
      this.events.emit('invoice.cancelled', { invoice: updated });
    } else if (status === InvoiceStatus.REJECTED) {
      this.events.emit('invoice.rejected', { invoice: updated });
    }

    return this.transformInvoiceForResponse(updated);
  }

  async update(id: string, data: Partial<CreateInvoiceData>) {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    // Converter valores para centavos se fornecidos
    const updateData: Partial<Invoice> = {
      ...data,
      totalValueCents: data.totalValue ? toCents(data.totalValue) : undefined,
      taxValueCents: data.taxValue ? toCents(data.taxValue) : undefined,
      discountValueCents: data.discountValue ? toCents(data.discountValue) : undefined,
    };

    // Remove campos que não existem na entidade
    delete (updateData as any).totalValue;
    delete (updateData as any).taxValue;
    delete (updateData as any).discountValue;

    const updated = await this.repo.update(id, updateData);
    return this.transformInvoiceForResponse(updated);
  }

  async remove(id: string) {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    await this.repo.remove(id);
  this.events.emit('invoice.deleted', { invoice });
    return { message: 'Nota fiscal removida com sucesso' };
  }

  async getStats() {
    return this.repo.getStats();
  }

  /**
   * Gera próximo número de nota fiscal baseado na série
   */
  async generateNextNumber(series: string): Promise<string> {
    const lastInvoice = await this.repo.findLastBySeries(series);

    if (!lastInvoice) {
      return '1';
    }

    const lastNumber = parseInt(lastInvoice.number);
    return (lastNumber + 1).toString();
  }

  /**
   * Envia nota fiscal para SEFAZ
   */
  async sendToSefaz(id: string): Promise<Invoice> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Nota fiscal deve estar em rascunho ou pendente para envio');
    }

    try {
      // Atualizar status para "enviando"
      await this.updateStatus(id, InvoiceStatus.PENDING);

      // Converter dados da nota fiscal para formato NFe
      const nfeData = this.convertInvoiceToNFeData(invoice);

      // Gerar XML
      const xmlContent = this.nfeXmlService.generateNFeXml(nfeData);

      // Salvar XML
      const xmlPath = await this.saveXmlFile(invoice.id, xmlContent);
      await this.repo.update(id, { xmlFilePath: xmlPath });

      // Enviar para SEFAZ
      const sefazResponse = await this.nfeWebServiceService.sendNFe(xmlContent);

      if (sefazResponse.success) {
        // Atualizar com dados da autorização
        await this.updateStatus(id, InvoiceStatus.AUTHORIZED, {
          accessKey: sefazResponse.accessKey,
          protocolNumber: sefazResponse.protocol,
          sefazResponse: sefazResponse.message
        });

  this.events.emit('invoice.authorized', { invoice: await this.repo.findOne(id) });
        
        // TODO: Gerar PDF e enviar por email
        
      } else {
        // Marcar como rejeitada
        await this.updateStatus(id, InvoiceStatus.REJECTED, {
          rejectionReason: sefazResponse.message,
          sefazResponse: JSON.stringify(sefazResponse.errors || [])
        });

  this.events.emit('invoice.rejected', { invoice: await this.repo.findOne(id), reason: sefazResponse.message });
      }

      return this.findOne(id);

    } catch (error: any) {
      await this.updateStatus(id, InvoiceStatus.REJECTED, {
        rejectionReason: `Erro interno: ${error.message}`
      });

      throw new BadRequestException(`Erro ao enviar para SEFAZ: ${error.message}`);
    }
  }

  /**
   * Emite NFSe (nota de serviço) via módulo nfse
   */
  async sendNfse(id: string): Promise<Invoice> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);

    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Nota fiscal deve estar em rascunho ou pendente para envio');
    }

    // Atualiza status
    await this.updateStatus(id, InvoiceStatus.PENDING);

    // Converter invoice para RPS/NFSe
    const rpsData = this.convertInvoiceToRps(invoice);
    const xml = this.nfseXmlService.generateRpsXml(rpsData);
    const signed = this.nfseSignatureService.signXml(xml);

    // Salvar XML
    const xmlPath = await this.saveNfseXmlFile(invoice.id, signed);
    await this.repo.update(id, { xmlFilePath: xmlPath });

    // Enviar para provedor — criamos registro NFSe com invoiceId antes do envio
    const { res: sendRes, record } = await this.nfseWebServiceService.createRecordAndSend(invoice.id, signed);
    if (sendRes.success) {
      await this.updateStatus(id, InvoiceStatus.AUTHORIZED, { sefazResponse: JSON.stringify(sendRes), protocolNumber: sendRes.protocol });
      this.events.emit('invoice.authorized', { invoice: await this.repo.findOne(id) });
    } else {
      await this.updateStatus(id, InvoiceStatus.REJECTED, { rejectionReason: sendRes.message, sefazResponse: JSON.stringify(sendRes) });
      this.events.emit('invoice.rejected', { invoice: await this.repo.findOne(id), reason: sendRes.message });
    }

    return this.findOne(id);
  }

  /**
   * Consulta status da nota fiscal na SEFAZ
   */
  async consultSefazStatus(id: string): Promise<any> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    if (!invoice.accessKey) {
      throw new BadRequestException('Nota fiscal não possui chave de acesso');
    }

    const response = await this.nfeWebServiceService.consultNFe(invoice.accessKey);
    
    return {
      invoice: this.transformInvoiceForResponse(invoice),
      sefazStatus: response
    };
  }

  /**
   * Valida campos obrigatórios antes de enviar para SEFAZ
   * Retorna array de mensagens de erro (vazio se tudo OK)
   */
  async validateBeforeSend(id: string): Promise<string[]> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);

    const errors: string[] = [];

    // Campos básicos
    if (!invoice.number) errors.push('Número da nota é obrigatório');
    if (!invoice.series) errors.push('Série é obrigatória');
    if (!invoice.issueDate) errors.push('Data de emissão é obrigatória');
    if (!invoice.clientName) errors.push('Nome do cliente é obrigatório');
    if (!invoice.clientDocument) errors.push('Documento do cliente (CPF/CNPJ) é obrigatório');

    // Valores
    if (!invoice.totalValueCents || invoice.totalValueCents <= 0) errors.push('Valor total deve ser maior que zero');

    // Itens (no mínimo 1)
    // Note: aqui usamos a descrição como proxy para existência de item no modelo atual
    if (!invoice.description || invoice.description.trim().length === 0) errors.push('Descrição/itens da nota são obrigatórios');

    // Certificado/config
    try {
      this.nfeConfigService.validateConfig();
    } catch (err: any) {
      errors.push(`Configuração NFe inválida: ${err.message}`);
    }

    return errors;
  }

  /**
   * Cancela nota fiscal na SEFAZ
   */
  async cancelNFe(id: string, justificativa: string): Promise<Invoice> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    if (invoice.status !== InvoiceStatus.AUTHORIZED) {
      throw new BadRequestException('Apenas notas fiscais autorizadas podem ser canceladas');
    }

    if (!invoice.accessKey || !invoice.protocolNumber) {
      throw new BadRequestException('Nota fiscal não possui chave de acesso ou protocolo');
    }

    try {
      const response = await this.nfeWebServiceService.cancelNFe(
        invoice.accessKey,
        justificativa,
        invoice.protocolNumber
      );

      if (response.success) {
        await this.updateStatus(id, InvoiceStatus.CANCELLED, {
          rejectionReason: justificativa,
          sefazResponse: response.message
        });

  this.events.emit('invoice.cancelled', { invoice: await this.repo.findOne(id), justificativa });
      } else {
        throw new BadRequestException(`Erro no cancelamento: ${response.message}`);
      }

      return this.findOne(id);

    } catch (error: any) {
      throw new BadRequestException(`Erro ao cancelar NFe: ${error.message}`);
    }
  }

  /**
   * Converte dados da Invoice para formato NFeData
   */
  private convertInvoiceToNFeData(invoice: Invoice): NFeData {
    const config = this.nfeConfigService.getConfig();
    const items = (invoice.items && invoice.items.length > 0)
      ? invoice.items.map((it) => ({
          codigo: it.codigo,
          descricao: it.descricao,
          ncm: it.ncm,
          cfop: it.cfop,
          unidade: it.unidade,
          quantidade: Number(it.quantidade),
          valorUnitario: it.valorUnitarioCents / 100,
          valorTotal: it.valorTotalCents / 100,
          icms: it.icmsCst ? { origem: it.icmsOrigem || '0', cst: it.icmsCst, aliquota: it.icmsAliquota || 0, valor: it.icmsValor || 0 } : undefined
        }))
      : [{
          codigo: '001',
          descricao: invoice.description,
          ncm: '84715010', // NCM genérico
          cfop: '5933',
          unidade: 'UN',
          quantidade: 1,
          valorUnitario: invoice.totalValue,
          valorTotal: invoice.totalValue
        }];

    const totalProdutos = items.reduce((sum, it) => sum + it.valorTotal, 0);

    return {
      numero: invoice.number,
      serie: invoice.series,
      dhEmi: new Date(invoice.issueDate),
      dhSaiEnt: invoice.dueDate ? new Date(invoice.dueDate) : undefined,

      destinatario: {
        cpfCnpj: invoice.clientDocument,
        nome: invoice.clientName,
        endereco: this.parseClientAddress(invoice.clientAddress || ''),
        email: invoice.clientEmail || undefined
      },

      items,

      total: {
        valorProdutos: totalProdutos,
        valorFrete: 0,
        valorSeguro: 0,
        valorDesconto: invoice.discountValue || 0,
        valorIcms: 0,
        valorIpi: 0,
        valorPis: 0,
        valorCofins: 0,
        valorNota: totalProdutos - (invoice.discountValue || 0)
      },

      infAdic: 'Nota fiscal emitida pelo sistema Mont System'
    };
  }

  /**
   * Parse básico do endereço do cliente
   */
  private parseClientAddress(address: string) {
    // Implementação básica - em produção, usar um parser mais robusto
    const parts = address.split(',');
    
    return {
      logradouro: parts[0]?.trim() || 'Não informado',
      numero: parts[1]?.trim() || 'S/N',
      complemento: undefined,
      bairro: parts[2]?.trim() || 'Centro',
      cep: '01234567',
      cidade: parts[3]?.trim() || 'São Paulo',
      codigoMunicipio: '3550308',
      uf: 'SP'
    };
  }

  /**
   * Converte Invoice para dados de RPS/NFSe
   */
  private convertInvoiceToRps(invoice: Invoice) {
    const tomador = {
      cpfCnpj: invoice.clientDocument,
      nome: invoice.clientName
    };

    const prestador = {
      cnpj: this.nfeConfigService.getConfig().company.cnpj.replace(/\D/g, ''),
      im: this.nfeConfigService.getConfig().company.ie || ''
    };

    const itens = (invoice.items || []).map(it => ({ descricao: it.descricao, valor: (it.valorTotalCents / 100) }));

    return {
      numero: invoice.number,
      serie: invoice.series,
      dataEmissao: invoice.issueDate,
      prestador,
      tomador,
      itens,
      valores: {
        total: invoice.totalValueCents / 100
      }
    };
  }

  private async saveNfseXmlFile(invoiceId: string, xmlContent: string): Promise<string> {
    const storageDir = path.join(process.cwd(), 'storage', 'nfse', 'xml');
    const fileName = `nfse-${invoiceId}.xml`;
    const filePath = path.join(storageDir, fileName);
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(filePath, xmlContent, 'utf8');
    return fileName;
  }

  /**
   * Salva arquivo XML no sistema de arquivos
   */
  private async saveXmlFile(invoiceId: string, xmlContent: string): Promise<string> {
    const storageDir = path.join(process.cwd(), 'storage', 'nfe', 'xml');
    const fileName = `nfe-${invoiceId}.xml`;
    const filePath = path.join(storageDir, fileName);

    // Criar diretório se não existir
    await fs.mkdir(storageDir, { recursive: true });

    // Salvar arquivo
    await fs.writeFile(filePath, xmlContent, 'utf8');

    return fileName; // Retornar apenas o nome do arquivo
  }

  async getOrGenerateDanfe(id: string): Promise<{ fileName: string; absolutePath: string }> {
    const invoice = await this.repo.findOne(id);
    if (!invoice) {
      throw new NotFoundException(`Nota fiscal com ID ${id} não encontrada`);
    }

    const baseDir = path.join(process.cwd(), 'storage', 'nfe', 'pdf');
    await fs.mkdir(baseDir, { recursive: true });

    let fileName = invoice.pdfFilePath;
    if (!fileName) {
      fileName = await this.danfeService.generateDanfe(invoice);
      await this.repo.update(id, { pdfFilePath: fileName } as any);
    }

    const absolutePath = path.join(baseDir, fileName);
    return { fileName, absolutePath };
  }

  /**
   * Transforma Invoice entity para incluir valores calculados na resposta
   */
  private transformInvoiceForResponse(invoice: Invoice) {
    return {
      ...invoice,
      totalValue: invoice.totalValue, // getter da entity
      taxValue: invoice.taxValue, // getter da entity
      discountValue: invoice.discountValue, // getter da entity
    };
  }
}