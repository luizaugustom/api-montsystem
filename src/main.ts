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

// Evolution: desligada por padrão. Só ativa com EVOLUTION_ENABLED=true (compose local).
{
  const evolutionEnabled = process.env.EVOLUTION_ENABLED === 'true';
  if (!evolutionEnabled) {
    console.log('[main] Evolution desabilitada (EVOLUTION_ENABLED!=true).');
  } else {
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
      let banner = '';
      if (fs.existsSync(secretPath)) {
        banner = fs
          .readFileSync(secretPath, 'utf8')
          .split(/\r?\n/)
          .filter((l: string) => l.trim() && !l.startsWith('EVOLUTION_API_KEY=') && !l.startsWith('EVOLUTION_WEBHOOK_SECRET='))
          .join('\n');
      }
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
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function resolveCorsOrigins(): string[] {
  const raw = (process.env.CORS_ORIGINS || '').trim();
  if (raw) {
    return raw
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);
  }
  const looksHosted =
    process.env.NODE_ENV === 'production' ||
    process.env.DATABASE_SSL === 'true' ||
    (process.env.DATABASE_HOST || '').includes('ondigitalocean');
  if (looksHosted) {
    throw new Error(
      'CORS_ORIGINS não configurado. Defina no App Platform, ex: ' +
        'CORS_ORIGINS=https://app.montsoftwares.com',
    );
  }
  return ['http://localhost:3002', 'http://127.0.0.1:3002'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = resolveCorsOrigins();
  console.log(`[boot] CORS_ORIGINS => ${corsOrigins.join(' | ')}`);

  // Somente Nest enableCors — middleware OPTIONS manual removido (respondia 204
  // sem Allow-Origin quando a origin não batia, gerando falso erro de CORS).
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin)) return callback(null, true);
      console.warn(`[cors] origin bloqueada: ${origin}`);
      return callback(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With, X-Webhook-Token, X-Evolution-Token',
    credentials: true,
    optionsSuccessStatus: 204,
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });

  // Probes do App Platform (path padrão costuma ser / ou /health)
  const expressApp = app.getHttpAdapter().getInstance();
  const ok = (_req: any, res: any) => res.status(200).json({ status: 'ok' });
  expressApp.get('/', ok);
  expressApp.get('/health', ok);

  const config = new DocumentBuilder().setTitle('api-montsystem').setVersion('1.0').addBearerAuth().build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((err) => {
  console.error('[boot] fatal:', err);
  process.exit(1);
});
