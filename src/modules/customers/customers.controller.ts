import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { z } from 'zod';
import { Customer } from './entities/customer.entity';
import { FilesInterceptor } from '@nestjs/platform-express';
import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { CustomersService } from './customers.service';
import { parseCurrency } from '../../shared/utils/currency';

const CustomerSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  cpfOrCnpj: z.string().optional(),
  tradeName: z.string().max(120).optional(),
  cep: z.string().regex(/^\d{8}$/, 'CEP deve ter 8 dígitos').optional(),
  street: z.string().max(120).optional(),
  number: z.string().max(10).optional(),
  complement: z.string().max(60).optional(),
  neighborhood: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  state: z.string().length(2, 'UF deve ter 2 caracteres').optional(),
  acquisitionDate: z.string().optional(),
  entryValue: z.preprocess((v) => parseCurrency(v), z.number().optional()),
  monthlyValue: z.preprocess((v) => parseCurrency(v), z.number().optional()),
  nextPaymentDate: z.string().optional(),
  productDescription: z.string().optional(),
});

@Controller('customers')
@UseGuards(AuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('invoices'))
  @Permissions('customers', 'edit')
  async create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    const parsed = CustomerSchema.parse(body);
    const invoices: string[] = [];
    if (files && files.length) {
      const storage = join(process.cwd(), 'storage', 'invoices');
      if (!existsSync(storage)) mkdirSync(storage, { recursive: true });
      files.forEach((f, i) => {
        const path = join(storage, `${Date.now()}-${i}-${f.originalname}`);
        writeFileSync(path, f.buffer);
        invoices.push(path);
      });
    }

    const customer = await this.customers.create({ ...parsed, invoices });
    return customer;
  }

  @Get()
  @Permissions('customers', 'view')
  findAll() {
    return this.customers.findAll();
  }

  @Get('active')
  @Permissions('customers', 'view')
  findActive() {
    return this.customers.findActive();
  }

  @Get(':id')
  @Permissions('customers', 'view')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Put(':id')
  @Permissions('customers', 'edit')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = CustomerSchema.partial().parse(body);
    return this.customers.update(id, parsed as any);
  }

  @Delete(':id')
  @Permissions('customers', 'edit')
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  @Post('list-by-month')
  @Permissions('customers', 'view')
  listByMonth(@Body() body: any) {
    const months: string[] = body.months || [];
    return this.customers.findByMonths(months);
  }
}
