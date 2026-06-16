import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { RESOURCES, type Level, type Resource } from '../../shared/permissions/resources';

const BCRYPT_COST = 10;
const PG_UNIQUE_VIOLATION = '23505';

export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  email?: string;
  role?: UserRole;
  active?: boolean;
  permissions?: { resource: Resource; level: Level }[];
}

export interface UpdateUserInput {
  name?: string;
  email?: string | null;
  password?: string;
  role?: UserRole;
  active?: boolean;
  permissions?: { resource: Resource; level: Level }[];
}

/**
 * Lógica de negócio de usuários. Garante:
 * - hash bcrypt de senhas (cost 10);
 * - invariante "último admin não pode ser desativado, despromovido ou deletado";
 * - bootstrap idempotente do primeiro admin a partir de `ADMIN_USER`/`ADMIN_PASSWORD`
 *   (tolerante a boot simultâneo de múltiplas instâncias).
 * - incremento de `tokenVersion` em mudanças que devem invalidar sessões.
 */
@Injectable()
export class UsersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly repo: UsersRepository,
  ) {}

  // ---------- Bootstrap ----------

  async onApplicationBootstrap(): Promise<void> {
    const count = await this.users.count();
    if (count > 0) return;

    const username = process.env.ADMIN_USER;
    const password = process.env.ADMIN_PASSWORD;
    if (!username || !password) {
      this.logger.warn(
        '[bootstrap] Tabela users vazia e ADMIN_USER/ADMIN_PASSWORD não configurados. ' +
          'Defina as envs e reinicie para criar o admin inicial, ou crie manualmente via SQL.',
      );
      return;
    }

    try {
      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      await this.users.insert({
        username,
        passwordHash,
        name: username,
        role: 'admin',
        active: true,
      });
      this.logger.log(`[bootstrap] Admin '${username}' criado. Troque a senha no primeiro login.`);
    } catch (err) {
      if (err instanceof QueryFailedError && (err as any).code === PG_UNIQUE_VIOLATION) {
        this.logger.log(`[bootstrap] Admin '${username}' já existe (corrida de boot simultâneo).`);
        return;
      }
      throw err;
    }
  }

  // ---------- Queries ----------

  list() {
    return this.repo.findAll();
  }

  async getById(id: string) {
    const u = await this.repo.findByIdWithPermissions(id);
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return u;
  }

  /**
   * Usado pelo `/auth/me`. Devolve apenas dados públicos — sem hash de senha
   * nem a matriz de permissões inteira (o frontend consulta permissões individuais
   * via guard do backend, ou usa o `role` para gatear).
   */
  async getPublicProfile(id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuário não encontrado');
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email ?? null,
      role: u.role,
    };
  }

  // ---------- Comandos ----------

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.repo.findByUsername(input.username);
    if (existing) throw new ConflictException('Username já em uso');

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        manager.create(User, {
          username: input.username,
          passwordHash,
          name: input.name,
          email: input.email,
          role: input.role ?? 'user',
          active: input.active ?? true,
        }),
      );

      if (input.permissions?.length) {
        const rows = input.permissions.map((p) =>
          manager.create('UserPermission', {
            userId: user.id,
            resource: p.resource,
            level: p.level,
          }),
        );
        await manager.save(rows);
      }

      return user;
    });
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const willChangeRole = input.role !== undefined && input.role !== user.role;
    const willDeactivate = input.active === false && user.active === true;
    const willDelete = false; // update não deleta

    if (willChangeRole || willDeactivate || willDelete) {
      await this.assertNotLastAdmin(id, user.role, user.active);
    }

    return this.dataSource.transaction(async (manager) => {
      const patch: Partial<User> = {};
      if (input.name !== undefined) patch.name = input.name;
      // email aceita null no schema (admin pode limpar); convertemos para undefined
      // porque a coluna é nullable mas o tipo TypeORM do entity não tipa null.
      if (input.email !== undefined) patch.email = input.email ?? undefined;
      if (input.password !== undefined) {
        patch.passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
      }
      if (input.role !== undefined) patch.role = input.role;
      if (input.active !== undefined) patch.active = input.active;

      let updated: User;
      if (Object.keys(patch).length) {
        await manager.update(User, { id }, patch);
        // qualquer mudança em password/role/active invalida tokens existentes
        await manager.increment(User, { id }, 'tokenVersion', 1);
        updated = (await manager.findOne(User, { where: { id } }))!;
      } else {
        updated = user;
      }

      if (input.permissions !== undefined) {
        await manager
          .createQueryBuilder()
          .delete()
          .from('user_permissions')
          .where('userId = :id', { id })
          .execute();
        if (input.permissions.length) {
          const rows = input.permissions.map((p) =>
            manager.create('UserPermission', {
              userId: id,
              resource: p.resource,
              level: p.level,
            }),
          );
          await manager.save(rows);
        }
      }

      return updated!;
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.assertNotLastAdmin(id, user.role, user.active);
    await this.users.delete({ id });
  }

  /**
   * Garante que ainda restará ao menos um admin ativo se a operação for adiante.
   * Deve ser chamado antes de qualquer update/delete que mude role/active.
   */
  private async assertNotLastAdmin(id: string, currentRole: UserRole, currentActive: boolean) {
    const wouldRemainAdmin = currentRole === 'admin' && currentActive;
    if (!wouldRemainAdmin) return;

    const count = await this.repo.countActiveAdmins();
    if (count <= 1) {
      throw new BadRequestException('Operação bloqueada: é o último administrador ativo do sistema');
    }
  }
}
