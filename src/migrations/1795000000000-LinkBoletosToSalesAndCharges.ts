import { MigrationInterface, QueryRunner } from 'typeorm';

export class LinkBoletosToSalesAndCharges1795000000000 implements MigrationInterface {
  name = 'LinkBoletosToSalesAndCharges1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Pre-flight: garante que não existem boletos avulsos legados
    //    (sem saleId nem monthlyChargeId). O CHECK constraint abaixo falharia
    //    para essas linhas, então abortamos cedo com mensagem clara.
    const orphans: Array<{ count: string }> = await queryRunner.query(
      `SELECT count(*)::int AS count FROM "boletos" WHERE "saleId" IS NULL AND "monthlyChargeId" IS NULL`,
    );
    const orphanCount = Number(orphans?.[0]?.count ?? 0);
    if (orphanCount > 0) {
      throw new Error(
        `Refusing to apply: ${orphanCount} boleto(s) avulso(s) (saleId e monthlyChargeId NULL). ` +
          `Backfill/delete antes de reexecutar.`,
      );
    }

    // 2) boletos.saleId + FK — boleto vinculado à venda
    await queryRunner.query(`ALTER TABLE "boletos" ADD COLUMN "saleId" uuid NULL`);
    await queryRunner.query(
      `ALTER TABLE "boletos" ADD CONSTRAINT "FK_boletos_sale" ` +
        `FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL`,
    );

    // 3) CHECK XOR — todo boleto deve ter exatamente um parent (sale XOR mensalidade).
    //    Reflete a regra de negócio: sem boleto avulso, sem boleto "de ambos".
    await queryRunner.query(
      `ALTER TABLE "boletos" ADD CONSTRAINT "CHK_boleto_exactly_one_origin" ` +
        `CHECK ((("saleId" IS NOT NULL)::int + ("monthlyChargeId" IS NOT NULL)::int) = 1)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // down NÃO restaura o estado "avulso": uma vez aplicado, boleto avulso
    // deixa de ser um estado válido. Rollback real requer SQL manual
    // (DROP da CHECK, DROP da coluna saleId, opcionalmente recriar dados).
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "CHK_boleto_exactly_one_origin"`);
    await queryRunner.query(`ALTER TABLE "boletos" DROP CONSTRAINT "FK_boletos_sale"`);
    await queryRunner.query(`ALTER TABLE "boletos" DROP COLUMN "saleId"`);
  }
}
