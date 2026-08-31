// Carrega variáveis de ambiente. Preferência: `.env` (local/secrets) > `.env.example` (template).
// Em produção (App Platform) as envs já vêm em process.env; dotenv NÃO sobrescreve chaves existentes.
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv');
const cwd = process.cwd();
const envFile = fs.existsSync(path.join(cwd, '.env'))
  ? path.join(cwd, '.env')
  : fs.existsSync(path.join(cwd, '.env.example'))
    ? path.join(cwd, '.env.example')
    : null;
if (envFile) {
  dotenv.config({ path: envFile });
}

// Fallback para chaves auto-geradas da Evolution: quando rodando fora do
// docker-compose (`npm run start:dev` em workstation, por exemplo), as variáveis
// `EVOLUTION_API_KEY` / `EVOLUTION_WEBHOOK_SECRET` não são injetadas via
// `env_file`. Lê o arquivo gerado pelo `bootstrap-secrets` (ou pelo script
// `scripts/bootstrap-evolution-keys.sh`) e injeta em `process.env` antes do
// Nest construir o grafo de módulos.
//
// Se o arquivo não existir OU existir mas sem `EVOLUTION_API_KEY=...` definido,
// gera chaves aleatórias, persiste no arquivo e injeta em process.env. Assim
// `npm run start:dev` funciona "out of the box" sem precisar rodar bootstrap.
{
  const crypto = require('crypto');
  const secretPath = path.join(cwd, 'secrets', 'evolution.env');
  let fileApi = '';
  let fileHook = '';
  if (fs.existsSync(secretPath)) {
    const raw = fs.readFileSync(secretPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^EVOLUTION_API_KEY=(.*)$/);
      if (m) fileApi = m[1].trim();
      const m2 = line.match(/^EVOLUTION_WEBHOOK_SECRET=(.*)$/);
      if (m2) fileHook = m2[1].trim();
    }
  }
  // Hierarquia: process.env > .env > arquivo > gerado agora
  let generated = false;
  if (!process.env.EVOLUTION_API_KEY) {
    if (!fileApi) {
      fileApi = crypto.randomBytes(32).toString('hex');
      generated = true;
    }
    process.env.EVOLUTION_API_KEY = fileApi;
  }
  if (!process.env.EVOLUTION_WEBHOOK_SECRET) {
    if (!fileHook) {
      fileHook = crypto.randomBytes(32).toString('hex');
      generated = true;
    }
    process.env.EVOLUTION_WEBHOOK_SECRET = fileHook;
  }
  // Se geramos agora OU o arquivo não tem as chaves ainda, persiste
  if (generated || !fileApi || !fileHook) {
    try {
      fs.mkdirSync(path.dirname(secretPath), { recursive: true });
      const banner = fs
        .readFileSync(secretPath, 'utf8')
        .split(/\r?\n/)
        .filter((l: string) => l.trim() && !l.startsWith('EVOLUTION_API_KEY=') && !l.startsWith('EVOLUTION_WEBHOOK_SECRET='))
        .join('\n');
      const content =
        (banner ? banner + '\n' : '') +
        `EVOLUTION_API_KEY=${process.env.EVOLUTION_API_KEY}\n` +
        `EVOLUTION_WEBHOOK_SECRET=${process.env.EVOLUTION_WEBHOOK_SECRET}\n`;
      fs.writeFileSync(secretPath, content, { mode: 0o644 });
    } catch (e: any) {
      console.warn(`[main] não foi possível persistir chaves em ${secretPath}: ${e?.message}`);
    }
  }
  if (generated) {
    console.log(
      `[main] EVOLUTION_API_KEY auto-gerada e persistida em ${path.relative(cwd, secretPath)}.\n` +
        `      Para a Evolution usar a mesma chave, defina AUTHENTICATION_API_KEY no ambiente dela\n` +
        `      ou rode \`docker compose up\` (o serviço bootstrap-secrets cuida disso).`,
    );
  } else if (fileApi) {
    console.log(`[main] EVOLUTION_API_KEY carregada de ${path.relative(cwd, secretPath)}`);
  }
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function resolveCorsOrigins(): string[] {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw) {
    return raw.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGINS não configurado. Em produção defina uma lista separada por vírgula ' +
        '(ex: https://app.seudominio.com,https://seu-projeto.vercel.app).',
    );
  }
  return ['http://localhost:3002', 'http://127.0.0.1:3002'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = resolveCorsOrigins();

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With, X-Webhook-Token, X-Evolution-Token',
    credentials: true,
    optionsSuccessStatus: 204,
  });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Request, Response, NextFunction } = require('express');
  app.use((req: typeof Request.prototype, res: typeof Response.prototype, next: typeof NextFunction.prototype) => {
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin as string | undefined;
      if (origin && corsOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Webhook-Token, X-Evolution-Token');
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
