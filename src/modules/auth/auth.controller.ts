import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { z } from 'zod';

const LoginSchema = z.object({ username: z.string(), password: z.string() });

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: any) {
    const parsed = LoginSchema.parse(body);
    return this.authService.login(parsed.username, parsed.password);
  }
}
