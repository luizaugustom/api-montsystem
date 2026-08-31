import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { WhatsappTemplatesRepository } from './whatsapp-templates.repository';
import { WhatsappTemplate } from './entities/whatsapp-template.entity';

@Injectable()
export class WhatsappTemplatesService {
  constructor(private repo: WhatsappTemplatesRepository) {}

  async create(data: Partial<WhatsappTemplate>): Promise<WhatsappTemplate> {
    if (!data.name?.trim()) throw new BadRequestException('Nome obrigatório');
    if (!data.text?.trim()) throw new BadRequestException('Texto obrigatório');
    // Unicidade de `name` é garantida pelo índice UNIQUE no banco (synchronize: true).
    return this.repo.create({ name: data.name.trim(), text: data.text.trim(), active: data.active ?? true });
  }

  findAll() {
    return this.repo.findAll();
  }

  findActive() {
    return this.repo.findActive();
  }

  findOne(id: string) {
    return this.repo.findById(id);
  }

  async update(id: string, patch: Partial<WhatsappTemplate>) {
    return this.repo.update(id, patch);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }
}