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
      complement?: string;
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

  async save(data: CompanyConfig | Record<string, any>): Promise<{ message: string }> {
    const existing = await this.get();
    const normalized = normalizeCompanyPayload(data, existing);

    const payload: Partial<Company> = {
      environment: normalized.environment,
      uf: normalized.uf,
      company: normalized.company,
      certificate: normalized.certificate ?? { path: '', password: '' },
      email: normalized.email ?? undefined,
      paths: normalized.paths ?? undefined,
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

/**
 * Aceita o shape aninhado da API ou o shape plano legado do front,
 * mesclando com o que já está no banco.
 */
function normalizeCompanyPayload(
  data: any,
  existing: CompanyConfig | null,
): CompanyConfig {
  // Shape aninhado (API / NFe)
  if (data?.company && typeof data.company === 'object') {
    return {
      environment: data.environment ?? existing?.environment ?? 'homologacao',
      uf: data.uf ?? existing?.uf ?? 'SP',
      company: {
        cnpj: data.company.cnpj ?? existing?.company?.cnpj ?? '',
        ie: data.company.ie ?? existing?.company?.ie ?? '',
        im: data.company.im ?? existing?.company?.im ?? '',
        name: data.company.name ?? existing?.company?.name ?? '',
        fantasy: data.company.fantasy ?? existing?.company?.fantasy ?? '',
        crt: Number(data.company.crt ?? existing?.company?.crt ?? 1),
        address: {
          street: data.company.address?.street ?? existing?.company?.address?.street ?? '',
          number: data.company.address?.number ?? existing?.company?.address?.number ?? '',
          neighborhood:
            data.company.address?.neighborhood ?? existing?.company?.address?.neighborhood ?? '',
          cep:
            data.company.address?.cep ??
            data.company.address?.zip ??
            existing?.company?.address?.cep ??
            '',
          city: data.company.address?.city ?? existing?.company?.address?.city ?? '',
          cityCode: data.company.address?.cityCode ?? existing?.company?.address?.cityCode ?? '',
          state: data.company.address?.state ?? existing?.company?.address?.state ?? '',
          complement:
            data.company.address?.complement ?? existing?.company?.address?.complement ?? '',
        },
        contact: {
          phone: data.company.contact?.phone ?? existing?.company?.contact?.phone ?? '',
          email: data.company.contact?.email ?? existing?.company?.contact?.email ?? '',
        },
      },
      certificate: data.certificate ?? existing?.certificate ?? { path: '', password: '' },
      email: data.email ?? existing?.email,
      paths: data.paths ?? existing?.paths,
    };
  }

  // Shape plano (legado do front)
  return {
    environment: data.environment ?? existing?.environment ?? 'homologacao',
    uf: data.uf ?? data.address?.state ?? existing?.uf ?? 'SP',
    company: {
      cnpj: data.cnpj ?? existing?.company?.cnpj ?? '',
      ie: data.ie ?? existing?.company?.ie ?? '',
      im: data.im ?? existing?.company?.im ?? '',
      name: data.name ?? existing?.company?.name ?? '',
      fantasy: data.fantasy ?? existing?.company?.fantasy ?? '',
      crt: Number(data.crt ?? existing?.company?.crt ?? 1),
      address: {
        street: data.address?.street ?? existing?.company?.address?.street ?? '',
        number: data.address?.number ?? existing?.company?.address?.number ?? '',
        neighborhood:
          data.address?.neighborhood ?? existing?.company?.address?.neighborhood ?? '',
        cep: data.address?.zip ?? data.address?.cep ?? existing?.company?.address?.cep ?? '',
        city: data.address?.city ?? existing?.company?.address?.city ?? '',
        cityCode: data.address?.cityCode ?? existing?.company?.address?.cityCode ?? '',
        state: data.address?.state ?? existing?.company?.address?.state ?? '',
        complement: data.address?.complement ?? existing?.company?.address?.complement ?? '',
      },
      contact: {
        phone: data.contact?.phone ?? existing?.company?.contact?.phone ?? '',
        email: data.contact?.email ?? existing?.company?.contact?.email ?? '',
      },
    },
    certificate: data.certificate?.path
      ? { path: data.certificate.path, password: data.certificate.password ?? '' }
      : existing?.certificate ?? { path: '', password: '' },
    email: existing?.email,
    paths: existing?.paths,
  };
}
