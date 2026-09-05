import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkInvoicesToSalesAndCharges1794000000000 implements MigrationInterface {
  name = 'LinkInvoicesToSalesAndCharges1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) invoices.monthlyChargeId — vincula invoice diretamente à mensalidade
    await queryRunner.query(`ALTER TABLE "invoices" ADD COLUMN "monthlyChargeId" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_monthly_charge" FOREIGN KEY ("monthlyChargeId") REFERENCES "monthly_charges"("id") ON DELETE SET NULL`,
    );

    // 2) sales.status + sales.paidAt — habilita lifecycle de pagamento na venda
    await queryRunner.query(
      `CREATE TYPE "public"."sales_status_enum" AS ENUM('PENDING', 'PAID', 'CANCELLED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" ADD COLUMN "status" "public"."sales_status_enum" NOT NULL DEFAULT 'PENDING'`,
    );
    await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "paidAt" date NULL`);
    await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "sales" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);

    // 3) nfse.invoiceId — corrige tipo (era integer incompatível com UUID da Invoice)
    await queryRunner.query(
      `ALTER TABLE "nfse" ALTER COLUMN "invoiceId" TYPE varchar USING "invoiceId"::varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "nfse" ALTER COLUMN "invoiceId" TYPE integer USING NULL`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "updatedAt"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "createdAt"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "paidAt"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."sales_status_enum"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_monthly_charge"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "monthlyChargeId"`);
  }
}
