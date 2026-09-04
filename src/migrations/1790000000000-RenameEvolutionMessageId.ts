import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameEvolutionMessageId1790000000000 implements MigrationInterface {
  name = 'RenameEvolutionMessageId1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres >= 9.6 faz metadata-only (sem table rewrite) — seguro em produção.
    await queryRunner.query(
      `ALTER TABLE "whatsapp_messages" RENAME COLUMN "evolutionMessageId" TO "providerMessageId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "whatsapp_messages" RENAME COLUMN "providerMessageId" TO "evolutionMessageId"`,
    );
  }
}