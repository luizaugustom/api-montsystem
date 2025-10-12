// Carrega variáveis de ambiente com prioridade: .env.local -> .env.docker -> .env
import * as fs from 'fs';
import * as path from 'path';
const cwd = process.cwd();
const candidates = ['.env.local', '.env.docker', '.env'].map((n) => path.join(cwd, n));
for (const p of candidates) {
  if (fs.existsSync(p)) {
    // carga o arquivo de ambiente encontrado e para
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config({ path: p });
    break;
  }
}
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Habilita CORS antes de registrar middlewares/guards que possam afetar o fluxo
  app.enableCors({
    origin: ['http://localhost:3002', 'http://127.0.0.1:3002'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // Garantir resposta imediata para OPTIONS (robustez extra)
  // tipagem explícita para evitar erros TS
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Request, Response, NextFunction } = require('express');
  app.use((req: typeof Request.prototype, res: typeof Response.prototype, next: typeof NextFunction.prototype) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      if (req.headers.origin && ['http://localhost:3002', 'http://127.0.0.1:3002'].includes(req.headers.origin)) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      return res.status(204).end();
    }
    next();
  });

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder().setTitle('api-montsystem').setVersion('1.0').addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
