import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';

let app: INestApplication;
let server: any;

beforeAll(async () => {
  app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.init();
  server = app.getHttpServer();
});

afterAll(async () => {
  await app.close();
});

describe('Auth + Customers (e2e)', () => {
  let token: string;

  it('login should return token', async () => {
    const res = await request(server).post('/api/auth/login').send({ username: 'luiz', password: '832010pj' });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('get customers (empty) should return 200', async () => {
    const res = await request(server).get('/api/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
