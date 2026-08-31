import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { parseCurrency, toCents } from '../../shared/utils/currency';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurrenceFrequency, PaymentMethod } from './entities/recurring-expense.entity';

const RecurringExpenseSchema = z.object({
  description: z.string().min(1),
  categoryId: z.string().uuid(),
  amount: z.preprocess((v) => parseCurrency(v), z.number().positive()),
  frequency: z.nativeEnum(RecurrenceFrequency),
  dayOfMonth: z.number().int().min(1).max(31),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  active: z.boolean().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  supplier: z.string().optional(),
  notes: z.string().optional(),
  reminderDaysBefore: z.array(z.number().int().min(0).max(60)).optional(),
});

@Controller('recurring-expenses')
@UseGuards(AuthGuard, PermissionsGuard)
export class RecurringExpensesController {
  constructor(private service: RecurringExpensesService) {}

  @Get()
  @Permissions('expenses', 'view')
  async list() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions('expenses', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions('expenses', 'edit')
  async create(@Body() body: any) {
    const parsed = RecurringExpenseSchema.parse(body);
    return this.service.create({
      description: parsed.description,
      categoryId: parsed.categoryId,
      amountCents: toCents(parsed.amount),
      frequency: parsed.frequency,
      dayOfMonth: parsed.dayOfMonth,
      dayOfWeek: parsed.dayOfWeek,
      monthDay: parsed.monthDay,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      active: parsed.active ?? true,
      paymentMethod: parsed.paymentMethod,
      supplier: parsed.supplier,
      notes: parsed.notes,
      reminderDaysBefore: parsed.reminderDaysBefore ?? [3],
    });
  }

  @Put(':id')
  @Permissions('expenses', 'edit')
  async update(@Param('id') id: string, @Body() body: any) {
    const partial = RecurringExpenseSchema.partial().parse(body);
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

  @Post(':id/generate-now')
  @Permissions('expenses', 'edit')
  async generateNow(@Param('id') id: string) {
    return this.service.generateOne(id);
  }
}