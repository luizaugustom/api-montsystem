import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { ContactsService } from './contacts.service';

const ContactSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(8, 'Telefone inválido'),
  notes: z.string().optional(),
  active: z.boolean().optional(),
});

@Controller('contacts')
@UseGuards(AuthGuard, PermissionsGuard)
export class ContactsController {
  constructor(private contacts: ContactsService) {}

  @Post()
  @Permissions('contacts', 'edit')
  async create(@Body() body: any) {
    const parsed = ContactSchema.parse(body);
    return this.contacts.create(parsed);
  }

  @Get()
  @Permissions('contacts', 'view')
  findAll() {
    return this.contacts.findAll();
  }

  @Get('active')
  @Permissions('contacts', 'view')
  findActive() {
    return this.contacts.findActive();
  }

  @Get(':id')
  @Permissions('contacts', 'view')
  findOne(@Param('id') id: string) {
    return this.contacts.findOne(id);
  }

  @Put(':id')
  @Permissions('contacts', 'edit')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = ContactSchema.partial().parse(body);
    return this.contacts.update(id, parsed as any);
  }

  @Delete(':id')
  @Permissions('contacts', 'edit')
  remove(@Param('id') id: string) {
    return this.contacts.remove(id);
  }
}