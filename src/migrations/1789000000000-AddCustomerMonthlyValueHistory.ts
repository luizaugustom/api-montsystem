import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerMonthlyValueHistory1789000000000 implements MigrationInterface {
  name = 'AddCustomerMonthlyValueHistory1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "monthlyValueHistory" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "monthlyValueHistory"`,
    );
  }
}
