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
import { ExpenseCategoriesService } from './expense-categories.service';

const CategorySchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  active: z.boolean().optional(),
});

@Controller('expense-categories')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExpenseCategoriesController {
  constructor(private service: ExpenseCategoriesService) {}

  @Get()
  @Permissions('expenses', 'view')
  async list() {
    return this.service.findAll();
  }

  @Get('active')
  @Permissions('expenses', 'view')
  async listActive() {
    return this.service.findAllActive();
  }

  @Get(':id')
  @Permissions('expenses', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Permissions('expenses', 'edit')
  async create(@Body() body: any) {
    const parsed = CategorySchema.parse(body);
    return this.service.create({ ...parsed, active: parsed.active ?? true });
  }

  @Put(':id')
  @Permissions('expenses', 'edit')
  async update(@Param('id') id: string, @Body() body: any) {
    const partial = CategorySchema.partial().parse(body);
    return this.service.update(id, partial);
  }

  @Delete(':id')
  @Permissions('expenses', 'edit')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}