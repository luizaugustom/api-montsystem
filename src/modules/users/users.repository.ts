import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserPermission } from './entities/user-permission.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserPermission) private readonly perms: Repository<UserPermission>,
  ) {}

  // -- Users --

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  findByUsername(username: string) {
    return this.users.findOne({ where: { username } });
  }

  findByIdWithPermissions(id: string) {
    return this.users.findOne({ where: { id }, relations: ['permissions'] });
  }

  findAll() {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  countActiveAdmins() {
    return this.users.count({ where: { role: 'admin', active: true } });
  }

  create(user: Partial<User>) {
    return this.users.save(this.users.create(user));
  }

  async save(user: Partial<User>) {
    return this.users.save(user);
  }

  async incrementTokenVersion(id: string) {
    await this.users.increment({ id }, 'tokenVersion', 1);
    return this.findById(id);
  }

  // -- Permissions --

  findPermissionsForUser(userId: string) {
    return this.perms.find({ where: { userId } });
  }

  async replacePermissions(userId: string, items: { resource: string; level: 'view' | 'edit' }[]) {
    await this.perms.delete({ userId });
    if (!items.length) return;
    const rows = items.map((p) =>
      this.perms.create({ userId, resource: p.resource as any, level: p.level }),
    );
    await this.perms.save(rows);
  }
}
