import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersRepository } from '../users/users.repository';

/**
 * AuthGuard: valida o JWT, busca o usuário no banco e popula `req.user`.
 *
 * Carrega apenas o mínimo necessário para a próxima camada (PermissõesGuard):
 * id, username, role, active, tokenVersion. Permissões granulares são lidas
 * sob demanda pelo PermissionsGuard (lazy) — rotas sem `@Permissions()` não
 * pagam esse custo extra.
 *
 * A leitura do banco a cada request garante revogação instantânea: ao
 * desativar um usuário ou incrementar `tokenVersion`, o próximo request dele
 * recebe 401 mesmo com JWT dentro da validade.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @Inject(forwardRef(() => UsersRepository))
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth) throw new UnauthorizedException('Sem token');

    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException('Formato do token inválido');
    }

    let payload;
    try {
      payload = this.authService.verifyToken(parts[1]);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuário não encontrado');
    if (!user.active) throw new UnauthorizedException('Usuário desativado');
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Sessão invalidada (senha alterada ou logout forçado)');
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      isAdmin: user.role === 'admin',
    };
    return true;
  }
}
