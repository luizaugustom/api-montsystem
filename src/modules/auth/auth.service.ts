import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Inject, forwardRef } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository';
import { User } from '../users/entities/user.entity';

if (!process.env.JWT_SECRET) {
  // Falha cedo: nunca aceitar o fallback 'dev-secret-montsystem' em produção.
  // Pode ser sobrescrito por .env em dev; em prod o processo não sobe sem isso.
  throw new Error('JWT_SECRET não configurado. Defina a env antes de iniciar a API.');
}
const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '1h';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  tokenVersion: number;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersRepository))
    private readonly users: UsersRepository,
  ) {}

  async login(username: string, password: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (!user.active) throw new UnauthorizedException('Usuário desativado');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const token = this.sign({ sub: user.id, username: user.username, tokenVersion: user.tokenVersion });
    return {
      token,
      user: this.toPublic(user),
    };
  }

  /**
   * Verifica o JWT e devolve o payload tipado. Não consulta o banco —
   * a checagem de `active`/`tokenVersion` é feita pelo AuthGuard a cada request.
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, SECRET) as JwtPayload;
    } catch (e) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  sign(payload: JwtPayload): string {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
  }

  toPublic(user: User) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email ?? null,
      role: user.role,
    };
  }
}
