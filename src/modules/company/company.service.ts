import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface CompanyConfig {
  environment: 'homologacao' | 'producao';
  uf: string;
  company: {
    cnpj: string;
    ie: string;
    name: string;
    fantasy?: string;
    crt: number;
    address: {
      street: string;
      number: string;
      neighborhood: string;
      cep: string;
      city: string;
      cityCode: string;
      state: string;
    };
    contact: {
      phone?: string;
      email?: string;
    }
  };
  certificate: {
    path: string;
    password: string;
  };
  email?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
  };
  paths?: {
    logo?: string;
    danfeTemplate?: string;
  };
}

@Injectable()
export class CompanyService {
  private getConfigPath() {
    const dir = path.join(process.cwd(), 'storage', 'config');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'company.json');
  }

  get(): CompanyConfig | null {
    const file = this.getConfigPath();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  }

  save(data: CompanyConfig) {
    const file = this.getConfigPath();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return { message: 'Configuração salva com sucesso' };
  }
}
