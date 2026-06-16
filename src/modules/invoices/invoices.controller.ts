import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, UploadedFiles, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceStatus, InvoiceType } from './entities/invoice.entity';
import { z } from 'zod';
import { parseCurrency } from '../../shared/utils/currency';
import { FilesInterceptor } from '@nestjs/platform-express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Response } from 'express';
import { Res } from '@nestjs/common';

// Schema de validação para criação de nota fiscal
const InvoiceItemSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(1),
  ncm: z.string().min(4),
  cfop: z.string().min(4),
  unidade: z.string().min(1),
  quantidade: z.number().positive(),
  valorUnitario: z.preprocess((v) => parseCurrency(v), z.number().positive()),
  icms: z.object({ origem: z.string(), cst: z.string(), aliquota: z.number().optional(), valor: z.number().optional() }).optional()
});

const CreateInvoiceSchema = z.object({
  number: z.string().min(1, 'Número da nota fiscal é obrigatório'),
  series: z.string().min(1, 'Série da nota fiscal é obrigatória'),
  type: z.nativeEnum(InvoiceType).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD').optional(),
  totalValue: z.preprocess((v) => parseCurrency(v), z.number().min(0, 'Valor total deve ser positivo')),
  taxValue: z.preprocess((v) => parseCurrency(v), z.number().min(0).optional()),
  discountValue: z.preprocess((v) => parseCurrency(v), z.number().min(0).optional()),
  clientName: z.string().min(1, 'Nome do cliente é obrigatório'),
  clientDocument: z.string().min(11, 'CPF/CNPJ é obrigatório'),
  clientEmail: z.string().email('Email inválido').optional(),
  clientAddress: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  items: z.array(InvoiceItemSchema).min(1, 'Informe ao menos um item').optional(),
  saleId: z.string().uuid('ID da venda deve ser um UUID válido').optional(),
});

// Schema para atualização de status
const UpdateStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
  accessKey: z.string().length(44, 'Chave de acesso deve ter 44 dígitos').optional(),
  protocolNumber: z.string().optional(),
  sefazResponse: z.string().optional(),
  rejectionReason: z.string().optional(),
});

@Controller('invoices')
@UseGuards(AuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  @Permissions('invoices', 'edit')
  async create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    const parsed = CreateInvoiceSchema.parse(body);
    
    // Processar arquivos XML/PDF se enviados
    let xmlFilePath: string | undefined;
    let pdfFilePath: string | undefined;
    
    if (files && files.length) {
      const storage = join(process.cwd(), 'storage', 'invoices');
      if (!existsSync(storage)) mkdirSync(storage, { recursive: true });
      
      files.forEach((file) => {
        const fileName = `${parsed.number}-${parsed.series}-${file.originalname}`;
        const filePath = join(storage, fileName);
        writeFileSync(filePath, file.buffer);
        
        if (file.originalname.toLowerCase().includes('.xml')) {
          xmlFilePath = filePath;
        } else if (file.originalname.toLowerCase().includes('.pdf')) {
          pdfFilePath = filePath;
        }
      });
    }

    return this.invoicesService.create({
      ...parsed,
      xmlFilePath,
      pdfFilePath
    } as any);
  }

  @Get()
  @Permissions('invoices', 'view')
  async findAll(
    @Query('status') status?: InvoiceStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('saleId') saleId?: string
  ) {
    if (saleId) {
      return this.invoicesService.findBySaleId(saleId);
    }
    
    if (status) {
      return this.invoicesService.findByStatus(status);
    }
    
    if (startDate && endDate) {
      return this.invoicesService.findByDateRange(startDate, endDate);
    }
    
    return this.invoicesService.findAll();
  }

  @Get('stats')
  @Permissions('invoices', 'view')
  getStats() {
    return this.invoicesService.getStats();
  }

  @Get('next-number/:series')
  @Permissions('invoices', 'view')
  async getNextNumber(@Param('series') series: string) {
    const nextNumber = await this.invoicesService.generateNextNumber(series);
    return { series, nextNumber };
  }

  @Get(':id')
  @Permissions('invoices', 'view')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Put(':id')
  @Permissions('invoices', 'edit')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = CreateInvoiceSchema.partial().parse(body);
    return this.invoicesService.update(id, parsed);
  }

  @Put(':id/status')
  @Permissions('invoices', 'edit')
  updateStatus(@Param('id') id: string, @Body() body: any) {
    const parsed = UpdateStatusSchema.parse(body);
    return this.invoicesService.updateStatus(id, parsed.status, parsed);
  }

  @Delete(':id')
  @Permissions('invoices', 'edit')
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }

  // === ENDPOINTS PARA INTEGRAÇÃO SEFAZ ===

  @Post(':id/send-sefaz')
  @Permissions('invoices', 'edit')
  async sendToSefaz(@Param('id') id: string) {
    return this.invoicesService.sendToSefaz(id);
  }

  @Post(':id/validate-before-send')
  @Permissions('invoices', 'view')
  async validateBeforeSend(@Param('id') id: string) {
    const errors = await this.invoicesService.validateBeforeSend(id);
    return { valid: errors.length === 0, errors };
  }

  @Get(':id/sefaz-status')
  @Permissions('invoices', 'view')
  async consultSefazStatus(@Param('id') id: string) {
    return this.invoicesService.consultSefazStatus(id);
  }

  @Post(':id/cancel')
  @Permissions('invoices', 'edit')
  async cancelNFe(@Param('id') id: string, @Body() body: { justificativa: string }) {
    const justificativa = body.justificativa;
    
    if (!justificativa || justificativa.length < 15) {
      throw new BadRequestException('Justificativa deve ter pelo menos 15 caracteres');
    }

    return this.invoicesService.cancelNFe(id, justificativa);
  }

  @Post(':id/files')
  @UseInterceptors(FilesInterceptor('files', 10))
  @Permissions('invoices', 'edit')
  async uploadFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    const storage = join(process.cwd(), 'storage', 'invoices');
    if (!existsSync(storage)) mkdirSync(storage, { recursive: true });

    let xmlFilePath: string | undefined;
    let pdfFilePath: string | undefined;

    files.forEach((file) => {
      const fileName = `${id}-${Date.now()}-${file.originalname}`;
      const filePath = join(storage, fileName);
      writeFileSync(filePath, file.buffer);

      if (file.originalname.toLowerCase().endsWith('.xml')) {
        xmlFilePath = fileName;
      } else if (file.originalname.toLowerCase().endsWith('.pdf')) {
        pdfFilePath = fileName;
      }
    });

    // Atualizar paths dos arquivos na nota fiscal
    const updateData: any = {};
    if (xmlFilePath) updateData.xmlFilePath = xmlFilePath;
    if (pdfFilePath) updateData.pdfFilePath = pdfFilePath;

    if (Object.keys(updateData).length > 0) {
      await this.invoicesService.update(id, updateData);
    }

    return {
      message: 'Arquivos enviados com sucesso',
      files: {
        xml: xmlFilePath,
        pdf: pdfFilePath
      }
    };
  }

  @Get(':id/danfe')
  @Permissions('invoices', 'view')
  async getDanfe(@Param('id') id: string, @Res() res: Response) {
    const fileInfo = await this.invoicesService.getOrGenerateDanfe(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileInfo.fileName}"`);
    return res.sendFile(fileInfo.absolutePath);
  }
}