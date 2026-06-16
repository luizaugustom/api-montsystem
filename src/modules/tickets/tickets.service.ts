import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketsRepository } from './tickets.repository';
import { CustomersService } from '../customers/customers.service';
import { SpacesService } from '../../shared/storage/spaces.service';
import { Ticket, TicketStatus, TicketPriority } from './entities/ticket.entity';

export interface CreateTicketInput {
  clientId: string;
  title: string;
  description: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  dueDate?: string | null;
  assigneeName?: string | null;
}

export interface UpdateTicketInput {
  clientId?: string;
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  dueDate?: string | null;
  assigneeName?: string | null;
  /** Quando true, remove os anexos existentes antes de persistir (default: false = concatena). */
  replaceAttachments?: boolean;
}

export interface TicketResponse extends Ticket {
  clientName: string | null;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private repo: TicketsRepository,
    private customers: CustomersService,
    private events: EventEmitter2,
    private spaces: SpacesService,
  ) {}

  async create(
    data: CreateTicketInput,
    files?: Express.Multer.File[],
  ): Promise<TicketResponse> {
    const client = await this.customers.findOne(data.clientId);
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    const uploaded = files && files.length
      ? await this.spaces.uploadFiles(files, 'attachments')
      : [];

    const created = await this.repo.create({
      clientId: data.clientId,
      title: data.title,
      description: data.description,
      status: data.status ?? TicketStatus.OPEN,
      priority: data.priority ?? TicketPriority.MEDIUM,
      dueDate: data.dueDate ?? null,
      assigneeName: data.assigneeName ?? null,
      attachments: uploaded,
    });

    this.events.emit('ticket.created', created);
    return this.transformForResponse(created);
  }

  async findAll(): Promise<TicketResponse[]> {
    const tickets = await this.repo.findAll();
    return this.enrichMany(tickets);
  }

  async findOne(id: string): Promise<TicketResponse | null> {
    const t = await this.repo.findOne(id);
    if (!t) return null;
    return this.enrichOne(t);
  }

  async update(
    id: string,
    patch: UpdateTicketInput,
    newFiles?: Express.Multer.File[],
  ): Promise<TicketResponse | null> {
    const existing = await this.repo.findOne(id);
    if (!existing) return null;

    if (patch.clientId && patch.clientId !== existing.clientId) {
      const client = await this.customers.findOne(patch.clientId);
      if (!client) throw new NotFoundException('Cliente não encontrado');
    }

    let nextAttachments = existing.attachments ?? [];
    if (newFiles && newFiles.length) {
      const uploaded = await this.spaces.uploadFiles(newFiles, 'attachments');
      if (patch.replaceAttachments) {
        nextAttachments = uploaded;
      } else {
        nextAttachments = [...nextAttachments, ...uploaded];
      }
    }

    const updated = await this.repo.update(id, {
      clientId: patch.clientId ?? existing.clientId,
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      status: patch.status ?? existing.status,
      priority: patch.priority ?? existing.priority,
      dueDate: patch.dueDate === undefined ? existing.dueDate : patch.dueDate,
      assigneeName: patch.assigneeName === undefined ? existing.assigneeName : patch.assigneeName,
      attachments: nextAttachments,
    });

    this.events.emit('ticket.updated', updated);
    return this.transformForResponse(updated);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }

  findByStatus(status: TicketStatus) {
    return this.repo.findByStatus(status);
  }

  findByClientId(clientId: string) {
    return this.repo.findByClientId(clientId);
  }

  findByPriority(priority: TicketPriority) {
    return this.repo.findByPriority(priority);
  }

  // ---- helpers ----

  private async enrichOne(t: Ticket): Promise<TicketResponse> {
    const client = await this.customers.findOne(t.clientId);
    return this.transformForResponse(t, client?.name ?? null);
  }

  private async enrichMany(tickets: Ticket[]): Promise<TicketResponse[]> {
    if (!tickets.length) return [];
    const ids = Array.from(new Set(tickets.map((t) => t.clientId)));
    const map = await this.customers.findByIds(ids);
    return tickets.map((t) =>
      this.transformForResponse(t, map.get(t.clientId)?.name ?? null),
    );
  }

  private transformForResponse(t: Ticket, clientName?: string | null): TicketResponse {
    return {
      ...t,
      clientName: clientName !== undefined ? clientName : null,
    };
  }
}
