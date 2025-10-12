import { Injectable } from '@nestjs/common';
import { NFeConfig, WEBSERVICE_URLS } from '../interfaces/nfe.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class NFeConfigService {
  private config!: NFeConfig;

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    // Base do ENV
    const base: NFeConfig = {
      environment: (process.env.NFE_ENVIRONMENT as 'homologacao' | 'producao') || 'homologacao',
      uf: process.env.NFE_UF || 'SP',
      timeout: parseInt(process.env.NFE_TIMEOUT || '30000'),
      
      company: {
        cnpj: process.env.COMPANY_CNPJ || '',
        ie: process.env.COMPANY_IE || '',
        name: process.env.COMPANY_NAME || '',
        fantasy: process.env.COMPANY_FANTASY || '',
        crt: parseInt(process.env.COMPANY_CRT || '3'),
        address: {
          street: process.env.COMPANY_ADDRESS || '',
          number: process.env.COMPANY_NUMBER || '',
          neighborhood: process.env.COMPANY_NEIGHBORHOOD || '',
          cep: process.env.COMPANY_CEP || '',
          city: process.env.COMPANY_CITY || '',
          cityCode: process.env.COMPANY_CITY_CODE || '',
          state: process.env.COMPANY_STATE || 'SP',
        },
        contact: {
          phone: process.env.COMPANY_PHONE || '',
          email: process.env.COMPANY_EMAIL || '',
        }
      },
      
      certificate: {
        path: process.env.CERT_PATH || '',
        password: process.env.CERT_PASSWORD || '',
      },
      
      email: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      
      series: parseInt(process.env.NFE_SERIES || '1'),
      lastNumber: parseInt(process.env.NFE_LAST_NUMBER || '0'),
      
      paths: {
        logo: process.env.NFE_LOGO_PATH,
        danfeTemplate: process.env.NFE_DANFE_TEMPLATE,
      }
    };

    // Tentar carregar arquivo de configuração persistente
    try {
      const configDir = path.join(process.cwd(), 'storage', 'config');
      const filePath = path.join(configDir, 'company.json');
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(raw);
        this.config = { ...base, ...json, company: { ...base.company, ...json.company }, certificate: { ...base.certificate, ...json.certificate }, email: { ...base.email, ...json.email }, paths: { ...base.paths, ...json.paths } } as NFeConfig;
        return;
      }
    } catch (e) {
      // Se falhar, mantém base do ENV
    }

    this.config = base;
  }

  getConfig(): NFeConfig {
    return this.config;
  }

  reload(): void {
    this.loadConfig();
  }

  getWebServiceUrls() {
    const { uf, environment } = this.config;
    
    if (!WEBSERVICE_URLS[uf]) {
      throw new Error(`UF ${uf} não configurada nos webservices`);
    }
    
    if (!WEBSERVICE_URLS[uf][environment]) {
      throw new Error(`Ambiente ${environment} não configurado para UF ${uf}`);
    }
    
    return WEBSERVICE_URLS[uf][environment];
  }

  updateLastNumber(number: number): void {
    this.config.lastNumber = number;
    // Aqui você pode salvar no banco de dados ou arquivo de configuração
    // Para simplificar, vamos apenas manter em memória
  }

  getNextNumber(): number {
    return this.config.lastNumber + 1;
  }

  isHomologacao(): boolean {
    return this.config.environment === 'homologacao';
  }

  isProducao(): boolean {
    return this.config.environment === 'producao';
  }

  validateConfig(): void {
    const required = [
      'company.cnpj',
      'company.ie', 
      'company.name',
      'certificate.path',
      'certificate.password'
    ];

    for (const field of required) {
      const value = this.getNestedValue(this.config, field);
      if (!value) {
        throw new Error(`Campo obrigatório não configurado: ${field}`);
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}