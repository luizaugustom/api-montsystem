import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateIntegrationsTable1793000000000 implements MigrationInterface {
  name = 'CreateIntegrationsTable1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "integrations" (
        "id" uuid NOT NULL,
        "data" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integrations" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_integrations_singleton" CHECK ("id" = '00000000-0000-0000-0000-000000000002')
      )
    `);

    // Linha inicial vazia — defaults de env entram via merge no IntegrationsStorage.
    await queryRunner.query(`
      INSERT INTO "integrations" ("id", "data")
      VALUES (
        '00000000-0000-0000-0000-000000000002',
        '{}'::jsonb
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "integrations"`);
  }
}
