import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyTable1792000000000 implements MigrationInterface {
  name = 'CreateCompanyTable1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "companies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "environment" character varying NOT NULL DEFAULT 'homologacao',
        "uf" character varying NOT NULL DEFAULT 'SP',
        "company" jsonb NOT NULL,
        "certificate" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "email" jsonb,
        "paths" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_companies_singleton" CHECK ("id" = '00000000-0000-0000-0000-000000000001')
      )
    `);

    // Garante a existência da extensão pgcrypto caso o projeto use uuid_generate_v4().
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Linha inicial (id do singleton) — sem dados válidos; usuário vai preencher via /empresa.
    await queryRunner.query(`
      INSERT INTO "companies" ("id", "environment", "uf", "company")
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        'homologacao',
        'SP',
        '{"cnpj":"","ie":"","name":"","crt":1,"address":{"street":"","number":"","neighborhood":"","cep":"","city":"","cityCode":"","state":""},"contact":{}}'::jsonb
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "companies"`);
  }
}
