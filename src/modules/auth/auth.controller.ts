import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from './user.decorator';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';

const LoginSchema = z.object({ username: z.string(), password: z.string() });

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UsersService,
    private readonly usersRepo: UsersRepository,
  ) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  async login(@Body() body: any) {
    const parsed = LoginSchema.parse(body);
    return this.authService.login(parsed.username, parsed.password);
  }

  /**
   * Perfil mínimo do usuário autenticado: id, username, name, email, role.
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: { id: string }) {
    return this.users.getPublicProfile(user.id);
  }

  /**
   * Matriz de permissões do próprio usuário autenticado. Usado pelo frontend
   * para gate de UI. O backend (PermissionsGuard) é a fronteira real — esta
   * informação é redundante com o que o guard checa a cada request.
   */
  @Get('permissions')
  @UseGuards(AuthGuard)
  async myPermissions(@CurrentUser() user: { id: string; role: string }) {
    if (user.role === 'admin') {
      // Admin tem tudo implicitamente — devolve nada para sinalizar bypass.
      return { isAdmin: true, permissions: [] as { resource: string; level: string }[] };
    }
    const perms = await this.usersRepo.findPermissionsForUser(user.id);
    return {
      isAdmin: false,
      permissions: perms.map((p) => ({ resource: p.resource, level: p.level })),
    };
  }
}
