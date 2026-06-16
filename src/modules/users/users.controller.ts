import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { LEVELS, RESOURCES } from '../../shared/permissions/resources';

const PermissionSchema = z.object({
  resource: z.enum(RESOURCES),
  level: z.enum(LEVELS),
});

const CreateUserSchema = z.object({
  username: z.string().min(3, 'Username deve ter ao menos 3 caracteres').max(64),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  name: z.string().min(1, 'Nome obrigatório'),
  email: z.string().email('Email inválido').optional(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
  permissions: z.array(PermissionSchema).optional(),
});

const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'user']).optional(),
  active: z.boolean().optional(),
  permissions: z.array(PermissionSchema).optional(),
});

@Controller('users')
@UseGuards(AuthGuard, PermissionsGuard)
@Permissions('users', 'edit')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list() {
    const all = await this.users.list();
    // nunca devolver passwordHash
    return all.map(({ passwordHash, ...rest }) => rest);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const u = await this.users.getById(id);
    const { passwordHash, ...rest } = u;
    return { ...rest, permissions: u.permissions ?? [] };
  }

  @Post()
  async create(@Body() body: any) {
    const parsed = CreateUserSchema.parse(body);
    const created = await this.users.create(parsed);
    const { passwordHash, ...rest } = created;
    return rest;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const parsed = UpdateUserSchema.parse(body);
    const updated = await this.users.update(id, parsed as any);
    const { passwordHash, ...rest } = updated;
    return rest;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.users.remove(id);
    return { ok: true };
  }
}
