import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './entities/contact.entity';

@Injectable()
export class ContactsRepository {
  constructor(
    @InjectRepository(Contact)
    private repo: Repository<Contact>,
  ) {}

  async create(data: Partial<Contact>): Promise<Contact> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  findAll(): Promise<Contact[]> {
    return this.repo.find({ order: { name: 'ASC', createdAt: 'DESC' } });
  }

  findActive(): Promise<Contact[]> {
    return this.repo.find({ where: { active: true }, order: { name: 'ASC' } });
  }

  findById(id: string): Promise<Contact | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByIds(ids: string[]): Promise<Contact[]> {
    if (!ids?.length) return Promise.resolve([]);
    return this.repo.findByIds(ids);
  }

  async update(id: string, patch: Partial<Contact>): Promise<Contact | null> {
    await this.repo.update({ id }, patch as any);
    return this.findById(id);
  }

  async remove(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected || 0) > 0;
  }
}