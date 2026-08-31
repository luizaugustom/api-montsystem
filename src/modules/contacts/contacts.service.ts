import { Injectable, BadRequestException } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import { Contact } from './entities/contact.entity';
import { EvolutionService } from '../../shared/services/evolution.service';

@Injectable()
export class ContactsService {
  constructor(private repo: ContactsRepository) {}

  async create(data: Partial<Contact>): Promise<Contact> {
    const phone = EvolutionService.normalizePhone(data.phone || '');
    if (!phone) {
      throw new BadRequestException('Telefone inválido');
    }
    return this.repo.create({ ...data, phone });
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

  findByIds(ids: string[]) {
    return this.repo.findByIds(ids);
  }

  async update(id: string, patch: Partial<Contact>) {
    if (patch.phone !== undefined) {
      const normalized = EvolutionService.normalizePhone(patch.phone || '');
      if (!normalized) {
        throw new BadRequestException('Telefone inválido');
      }
      patch.phone = normalized;
    }
    return this.repo.update(id, patch);
  }

  remove(id: string) {
    return this.repo.remove(id);
  }
}