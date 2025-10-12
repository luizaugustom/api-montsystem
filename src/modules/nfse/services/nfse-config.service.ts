import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NfseConfigService {
  private config: any = {
    environment: process.env.NFSE_ENVIRONMENT || 'homologacao',
    municipality: 'SAO_PAULO',
    provider: 'GINFES',
    timeout: 30000,
    certificate: {
      path: '',
      password: ''
    }
  };

  constructor() {
    const cfgPath = path.join(process.cwd(), 'storage', 'config', 'nfse.json');
    if (fs.existsSync(cfgPath)) {
      try {
        const raw = fs.readFileSync(cfgPath, 'utf8');
        this.config = { ...this.config, ...JSON.parse(raw) };
      } catch (e) {
        // ignore
      }
    }
  }

  getConfig() {
    return this.config;
  }

  reload() {
    const cfgPath = path.join(process.cwd(), 'storage', 'config', 'nfse.json');
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf8');
      this.config = { ...this.config, ...JSON.parse(raw) };
    }
  }
}
