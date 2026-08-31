import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

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

const useSsl =
  process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'montsystem',
  entities: [path.join(__dirname, '**', '*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  extra: {
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 15000),
  },
});
