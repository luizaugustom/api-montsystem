import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { UserPermission } from '../../modules/users/entities/user-permission.entity';
import {
  PERMISSIONS_METADATA_KEY,
} from '../decorators/permissions.decorator';
import { satisfies, type Level, type Resource } from '../permissions/resources';

interface RequiredPermission {
  resource: Resource;
  level: Level;
}

/**
 * Guard de permissões granulares. Deve ser aplicado **após** o `AuthGuard`,
 * que é quem popula `req.user` com `{ id, username, role, isAdmin }`.
 *
 * Comportamento:
 * - Sem `@Permissions()` na rota → permite (rota permission-agnostic).
 * - Admin (`role === 'admin'`) → ignora a checagem.
 * - Usuário normal → busca `user_permissions` para `(userId, resource)` e
 *   compara o nível guardado com o nível exigido. `edit` cobre `view`.
 * - Sem permissão ou nível insuficiente → 403.
 *
 * Segurança: a permissão é sempre lida do banco a cada request (sem cache),
 * garantindo revogação imediata quando o admin desativa uma permissão.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @InjectRepository(UserPermission)
    private readonly permsRepo: Repository<UserPermission>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Rota sem @Permissions() — passa direto. A auth (se exigida) é responsabilidade
    // do AuthGuard, que deve ter sido registrado antes deste.
    if (!required) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; role?: string } | undefined;

    // Rota com @Permissions() mas sem AuthGuard (ex.: webhook) — bloqueia por padrão
    // em vez de vazar. O 403 aqui sinaliza erro de configuração.
    if (!user || !user.id) {
      throw new ForbiddenException('Acesso negado');
    }

    // Admin ignora a matriz. A role é lida do banco a cada request pelo AuthGuard,
    // portanto mudanças em `users.role` têm efeito imediato.
    if (user.role === 'admin') return true;

    const perm = await this.permsRepo.findOne({
      where: { userId: user.id, resource: required.resource },
    });

    if (!perm) {
      throw new ForbiddenException(`Sem acesso a "${required.resource}"`);
    }

    if (!satisfies(perm.level, required.level)) {
      throw new ForbiddenException(
        `Permissão insuficiente em "${required.resource}" (requer ${required.level}, possui ${perm.level})`,
      );
    }

    return true;
  }
}
