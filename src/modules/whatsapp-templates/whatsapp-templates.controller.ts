import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

const TemplateSchema = z.object({
  name: z.string().min(1).max(80),
  text: z.string().min(1),
  active: z.boolean().optional(),
});

@Controller('whatsapp/templates')
@UseGuards(AuthGuard, PermissionsGuard)
export class WhatsappTemplatesController {
  constructor(private templates: WhatsappTemplatesService) {}

  @Post()
  @Permissions('whatsapp', 'edit')
  async create(@Body() body: any) {
    const parsed = TemplateSchema.parse(body);
    return this.templates.create(parsed);
  }

  @Get()
  @Permissions('whatsapp', 'view')
  findAll() {
    return this.templates.findAll();
  }

  @Get('active')
  @Permissions('whatsapp', 'view')
  findActive() {
    return this.templates.findActive();
  }

  @Get(':id')
  @Permissions('whatsapp', 'view')
  findOne(@Param('id') id: string) {
    return this.templates.findOne(id);
  }

  @Put(':id')
  @Permissions('whatsapp', 'edit')
  update(@Param('id') id: string, @Body() body: any) {
    const parsed = TemplateSchema.partial().parse(body);
    return this.templates.update(id, parsed as any);
  }

  @Delete(':id')
  @Permissions('whatsapp', 'edit')
  remove(@Param('id') id: string) {
    return this.templates.remove(id);
  }
}