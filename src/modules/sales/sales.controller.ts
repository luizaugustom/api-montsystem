import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Sale } from './entities/sale.entity';
import { SalesService } from './sales.service';
import { z } from 'zod';
import { parseCurrency } from '../../shared/utils/currency';

const SaleSchema = z.object({
  clientName: z.string(),
  phone: z.string(),
  cpfOrCnpj: z.string().optional(),
  address: z.string().optional(),
  saleDate: z.string().optional(),
  warrantyEndDate: z.string().optional(),
  productDescription: z.string().optional(),
  // Novos campos para valor da venda
  clientId: z.string().optional(),
  saleValue: z.preprocess((v) => parseCurrency(v), z.number().min(0).optional()),
  isMonthly: z.boolean().optional().default(false),
  entryValue: z.preprocess((v) => parseCurrency(v), z.number().min(0).optional()),
  monthlyValue: z.preprocess((v) => parseCurrency(v), z.number().min(0).optional()),
  nextPaymentDate: z.string().optional(),
});

@Controller('sales')
@UseGuards(AuthGuard, PermissionsGuard)
export class SalesController {
  constructor(private sales: SalesService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  @Permissions('sales', 'edit')
  async create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    const parsed = SaleSchema.parse(body);
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

    const sale = await this.sales.create({ ...parsed, contractFile: contract, invoiceFile: invoice });
    return sale;
  }

  @Get()
  @Permissions('sales', 'view')
  findAll() {
    return this.sales.findAll();
  }

  @Get(':id')
  @Permissions('sales', 'view')
  findOne(@Param('id') id: string) {
    return this.sales.findOne(id);
  }

  @Put(':id')
  @Permissions('sales', 'edit')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = SaleSchema.partial().parse(body);
    return this.sales.update(id, parsed as any);
  }

  @Delete(':id')
  @Permissions('sales', 'edit')
  remove(@Param('id') id: string) {
    return this.sales.remove(id);
  }

  @Post('list-by-month')
  @Permissions('sales', 'view')
  listByMonth(@Body() body: any) {
    const months: string[] = body.months || [];
    return this.sales.findByMonths(months);
  }
}
