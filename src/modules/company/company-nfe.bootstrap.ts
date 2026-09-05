import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CompanyService } from './company.service';
import { NFeConfigService } from '../nfe/services/nfe-config.service';

/**
 * Carrega a empresa do Postgres na memória do NFeConfig no boot —
 * evita depender de company.json em disco efêmero.
 */
@Injectable()
export class CompanyNfeBootstrap implements OnModuleInit {
  private readonly logger = new Logger(CompanyNfeBootstrap.name);

  constructor(
    private readonly company: CompanyService,
    private readonly nfeConfig: NFeConfigService,
  ) {}

  async onModuleInit() {
    try {
      const cfg = await this.company.get();
      if (cfg?.company?.cnpj) {
        this.nfeConfig.applyFromCompany(cfg);
        this.logger.log('NFeConfig sincronizado a partir do Postgres (companies)');
      }
    } catch (e: any) {
      this.logger.warn(`Falha ao sincronizar NFeConfig do Postgres: ${e?.message || e}`);
    }
  }
}
