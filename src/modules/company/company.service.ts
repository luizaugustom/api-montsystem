import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity';

export interface CompanyConfig {
  environment: 'homologacao' | 'producao';
  uf: string;
  company: {
    cnpj: string;
    ie: string;
    /** Inscrição Municipal — exigida na emissão de NFSe. Vem do cadastro da
     *  prefeitura, não confundir com a IE (estadual). */
    im?: string;
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
    };
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

/** ID fixo do singleton — toda a aplicação lê/grava nesta linha. */
const COMPANY_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company) private readonly repo: Repository<Company>,
  ) {}

  async get(): Promise<CompanyConfig | null> {
    const row = await this.repo.findOne({ where: { id: COMPANY_SINGLETON_ID } });
    if (!row) return null;
    return {
      environment: row.environment,
      uf: row.uf,
      company: row.company,
      certificate: row.certificate ?? { path: '', password: '' },
      email: row.email ?? undefined,
      paths: row.paths ?? undefined,
    };
  }

  async save(data: CompanyConfig): Promise<{ message: string }> {
    // Upsert: cria se não existir, atualiza se já existir — sempre no id do singleton.
    const payload: Partial<Company> = {
      environment: data.environment,
      uf: data.uf,
      company: data.company,
      certificate: data.certificate ?? { path: '', password: '' },
      email: data.email ?? undefined,
      paths: data.paths ?? undefined,
    };

    // INSERT … ON CONFLICT (id) DO UPDATE — preserva createdAt.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(Company)
      .values({ id: COMPANY_SINGLETON_ID, ...payload })
      .orUpdate(
        ['environment', 'uf', 'company', 'certificate', 'email', 'paths'],
        ['id'],
      )
      .execute();

    return { message: 'Configuração salva com sucesso' };
  }
}
