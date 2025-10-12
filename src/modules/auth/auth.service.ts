import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

const USERNAME = 'luiz';
const PASSWORD = '832010pj';
const SECRET = process.env.JWT_SECRET || 'dev-secret-montsystem';

@Injectable()
export class AuthService {
  login(username: string, password: string) {
    if (username !== USERNAME || password !== PASSWORD) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: username };
    return { token: jwt.sign(payload, SECRET, { expiresIn: '12h' }) };
  }

  verifyToken(token: string) {
    try {
      return jwt.verify(token, SECRET);
    } catch (e) {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
