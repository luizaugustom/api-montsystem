import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (!auth) throw new UnauthorizedException('Sem token');

    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') throw new UnauthorizedException('Formato do token inválido');

    const token = parts[1];
    const payload = this.authService.verifyToken(token);
    req.user = payload;
    return true;
  }
}
