import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { parseCurrency, toCents } from '../../shared/utils/currency';
import { ExpensesService } from './expenses.service';
import { ExpenseStatus, Expense } from './entities/expense.entity';

/**
 * Schema aceita `amount` em formato "1234,56" e converte para amountCents.
 * Mantém o pattern dos outros controllers (customers) — Zod inline no topo.
 */
const ExpenseSchema = z.object({
  description: z.string().min(1),
  categoryId: z.string().uuid().optional(),
  amount: z.preprocess((v) => parseCurrency(v), z.number().positive()),
  dueDate: z.string(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  paymentMethod: z.string().optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  recurringExpenseId: z.string().uuid().optional(),
});

function toCreatePayload(body: any, attachments: string[]) {
  const parsed = ExpenseSchema.parse(body);
  return {
    description: parsed.description,
    categoryId: parsed.categoryId,
    amountCents: toCents(parsed.amount),
    dueDate: parsed.dueDate,
    status: parsed.status || ExpenseStatus.PENDING,
    paymentMethod: parsed.paymentMethod as any,
    supplier: parsed.supplier,
    notes: parsed.notes,
    recurringExpenseId: parsed.recurringExpenseId,
    attachments: attachments.length ? attachments : undefined,
  } as Partial<Expense>;
}

@Controller('expenses')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private service: ExpensesService) {}

  @Get()
  @Permissions('expenses', 'view')
  async list(
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status: status as ExpenseStatus,
      categoryId,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 500,
    });
  }

  @Get('upcoming')
  @Permissions('expenses', 'view')
  async upcoming(@Query('days') days?: string) {
    return this.service.findUpcoming(days ? Math.min(Number(days), 90) : 7);
  }

  @Get('overdue')
  @Permissions('expenses', 'view')
  async overdue() {
    return this.service.findOverdue();
  }

  @Get('dashboard')
  @Permissions('expenses', 'view')
  async dashboard() {
    return this.service.dashboard();
  }

  @Get(':id')
  @Permissions('expenses', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('attachments'))
  @Permissions('expenses', 'edit')
  async create(@Body() body: any, @UploadedFiles() files: Express.Multer.File[]) {
    const paths: string[] = [];
    if (files && files.length) {
      const storage = join(process.cwd(), 'storage', 'expenses');
      if (!existsSync(storage)) mkdirSync(storage, { recursive: true });
      files.forEach((f, i) => {
        const p = join(storage, `${Date.now()}-${i}-${f.originalname}`);
        writeFileSync(p, f.buffer);
        paths.push(p);
      });
    }
    const payload = toCreatePayload(body, paths);
    return this.service.create(payload);
  }

  @Put(':id')
  @Permissions('expenses', 'edit')
  async update(@Param('id') id: string, @Body() body: any) {
    // Permite atualização parcial.
    const partial = ExpenseSchema.partial().parse(body);
    const payload: any = { ...partial };
    if (partial.amount != null) payload.amountCents = toCents(partial.amount);
    delete payload.amount;
    return this.service.update(id, payload);
  }

  @Delete(':id')
  @Permissions('expenses', 'edit')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/mark-paid')
  @Permissions('expenses', 'edit')
  async markPaid(@Param('id') id: string, @Body() body: { paidDate?: string }) {
    return this.service.markAsPaid(id, body?.paidDate);
  }

  @Post(':id/cancel')
  @Permissions('expenses', 'edit')
  async cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}