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
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { TicketsService } from './tickets.service';
import { TicketStatus, TicketPriority } from './entities/ticket.entity';

const CreateTicketSchema = z.object({
  clientId: z.string().min(1, 'Cliente é obrigatório'),
  title: z.string().min(2, 'Título deve ter ao menos 2 caracteres'),
  description: z.string().min(1, 'Descrição é obrigatória'),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeName: z.string().optional().nullable(),
});

const UpdateTicketSchema = CreateTicketSchema.partial().extend({
  replaceAttachments: z.boolean().optional(),
});

@Controller('tickets')
@UseGuards(AuthGuard, PermissionsGuard)
export class TicketsController {
  constructor(private tickets: TicketsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  @Permissions('tickets', 'edit')
  async create(
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parsed = CreateTicketSchema.parse(body);
    return this.tickets.create(
      {
        clientId: parsed.clientId,
        title: parsed.title,
        description: parsed.description,
        status: parsed.status,
        priority: parsed.priority,
        dueDate: parsed.dueDate,
        assigneeName: parsed.assigneeName,
      },
      files,
    );
  }

  @Get()
  @Permissions('tickets', 'view')
  async findAll(
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('priority') priority?: string,
  ) {
    if (status && Object.values(TicketStatus).includes(status as TicketStatus)) {
      return this.tickets.findByStatus(status as TicketStatus);
    }
    if (clientId) {
      return this.tickets.findByClientId(clientId);
    }
    if (priority && Object.values(TicketPriority).includes(priority as TicketPriority)) {
      return this.tickets.findByPriority(priority as TicketPriority);
    }
    return this.tickets.findAll();
  }

  @Get(':id')
  @Permissions('tickets', 'view')
  async findOne(@Param('id') id: string) {
    const ticket = await this.tickets.findOne(id);
    if (!ticket) return null;
    return ticket;
  }

  @Put(':id')
  @UseInterceptors(FilesInterceptor('files', 10))
  @Permissions('tickets', 'edit')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const parsed = UpdateTicketSchema.parse(body);
    return this.tickets.update(id, parsed as any, files);
  }

  @Delete(':id')
  @Permissions('tickets', 'edit')
  remove(@Param('id') id: string) {
    return this.tickets.remove(id);
  }
}
