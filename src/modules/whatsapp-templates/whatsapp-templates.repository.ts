import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsappTemplate } from './entities/whatsapp-template.entity';

@Injectable()
export class WhatsappTemplatesRepository {
  constructor(
    @InjectRepository(WhatsappTemplate)
    private repo: Repository<WhatsappTemplate>,
  ) {}

  async create(data: Partial<WhatsappTemplate>): Promise<WhatsappTemplate> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  findAll(): Promise<WhatsappTemplate[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  findActive(): Promise<WhatsappTemplate[]> {
    return this.repo.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  findById(id: string): Promise<WhatsappTemplate | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, patch: Partial<WhatsappTemplate>): Promise<WhatsappTemplate | null> {
    await this.repo.update({ id }, patch as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected || 0) > 0;
  }
}