import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SalesService } from './sales.service';
import { z } from 'zod';
import { parseCurrency } from '../../shared/utils/currency';

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

const SaleSchema = z.object({
  clientName: z.string().min(1),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  cpfOrCnpj: z.preprocess(emptyToUndefined, z.string().optional()),
  address: z.preprocess(emptyToUndefined, z.string().optional()),
  saleDate: z.preprocess(emptyToUndefined, z.string().optional()),
  warrantyEndDate: z.preprocess(emptyToUndefined, z.string().optional()),
  productDescription: z.preprocess(emptyToUndefined, z.string().optional()),
  clientId: z.preprocess(emptyToUndefined, z.string().optional()),
  saleValue: z.preprocess((v) => parseCurrency(emptyToUndefined(v)), z.number().min(0).optional()),
  isMonthly: z.preprocess((v) => {
    if (v === undefined || v === null || v === '') return undefined;
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return v;
  }, z.boolean().optional()),
  entryValue: z.preprocess((v) => parseCurrency(emptyToUndefined(v)), z.number().min(0).optional()),
  monthlyValue: z.preprocess((v) => parseCurrency(emptyToUndefined(v)), z.number().min(0).optional()),
  nextPaymentDate: z.preprocess(emptyToUndefined, z.string().optional()),
});

const SaleSchemaPartial = SaleSchema.partial();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertSaleId(id: string) {
  if (!UUID_RE.test(id)) {
    throw new BadRequestException(
      'ID de venda inválido. Mensalidades/entradas derivadas do cliente não podem ser editadas por aqui.',
    );
  }
}

function parseSaleBody(body: any): z.infer<typeof SaleSchema> {
  const parsed = SaleSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.errors.map((e) => e.message).join('; '));
  }
  return parsed.data;
}

function parseSaleBodyPartial(body: any): z.infer<typeof SaleSchemaPartial> {
  const parsed = SaleSchemaPartial.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.errors.map((e) => e.message).join('; '));
  }
  return parsed.data;
}

@Controller('sales')
@UseGuards(AuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private sales: SalesService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  @Permissions('sales', 'edit')
  async create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    const parsed = parseSaleBody(body);
    if (!parsed.phone) {
      throw new BadRequestException('Telefone é obrigatório');
    }
    const id = `${Date.now()}`;
    const storage = join(process.cwd(), 'storage', 'sales');
    if (!existsSync(storage)) mkdirSync(storage, { recursive: true });
    let contract: string | undefined;
    let invoice: string | undefined;
    if (files && files.length) {
      files.forEach((f) => {
        const path = join(storage, `${id}-${f.originalname}`);
        writeFileSync(path, f.buffer);
        if (f.originalname.toLowerCase().includes('contract')) contract = path;
        if (f.originalname.toLowerCase().includes('invoice') || f.originalname.toLowerCase().includes('nota')) invoice = path;
      });
    }

    const sale = await this.sales.create({
      ...parsed,
      phone: parsed.phone,
      contractFile: contract,
      invoiceFile: invoice,
    });
    return sale;
  }

  @Get()
  @Permissions('sales', 'view')
  findAll() {
    return this.sales.findAll();
  }

  @Get(':id')
  @Permissions('sales', 'view')
  async findOne(@Param('id') id: string) {
    assertSaleId(id);
    const sale = await this.sales.findOne(id);
    if (!sale) throw new NotFoundException('Venda não encontrada');
    return sale;
  }

  @Put(':id')
  @Permissions('sales', 'edit')
  async update(@Param('id') id: string, @Body() body: any) {
    assertSaleId(id);
    const parsed = parseSaleBodyPartial(body);
    const updated = await this.sales.update(id, parsed);
    if (!updated) throw new NotFoundException('Venda não encontrada');
    return updated;
  }

  @Delete(':id')
  @Permissions('sales', 'edit')
  async remove(@Param('id') id: string) {
    assertSaleId(id);
    return this.sales.remove(id);
  }

  @Post('list-by-month')
  @Permissions('sales', 'view')
  listByMonth(@Body() body: any) {
    const months: string[] = body.months || [];
    return this.sales.findByMonths(months);
  }
}
