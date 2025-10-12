import { Body, Controller, Delete, Get, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
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
  address: z.string().optional(),
  acquisitionDate: z.string().optional(),
  entryValue: z.preprocess((v) => parseCurrency(v), z.number().optional()),
  monthlyValue: z.preprocess((v) => parseCurrency(v), z.number().optional()),
  nextPaymentDate: z.string().optional(),
  productDescription: z.string().optional(),
});

@Controller('customers')
@UseGuards(AuthGuard)
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('invoices'))
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
  findAll() {
    return this.customers.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = CustomerSchema.partial().parse(body);
    return this.customers.update(id, parsed as any);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }

  @Post('list-by-month')
  listByMonth(@Body() body: any) {
    const months: string[] = body.months || [];
    return this.customers.findByMonths(months);
  }
}
