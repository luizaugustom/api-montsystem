import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvoiceCustomerId1791000000000 implements MigrationInterface {
  name = 'AddInvoiceCustomerId1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" ADD COLUMN "customerId" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_customer"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "customerId"`);
  }
}
