import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { IntegrationSettings } from './entities/integration-settings.entity';

export type IntegrationKey = 'unimake' | 'focus-nfe' | 'resend' | 'zapi';

export interface UnimakeConfig {
  apiUrl: string;
  apiKey: string;
  banco: string;
  agencia: string;
  conta: string;
  convenio: string;
  carteira: string;
  especie: string;
  instrucoes: string;
  multaPercent: number;
  jurosPercent: number;
  webhookSecret: string;
}

export interface FocusNfeConfig {
  baseUrl: string;
  token: string;
  ambiente: 'homologacao' | 'producao';
  refPadrao: string;
  automaticoNoPagamento: boolean;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

export interface ZapiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
  webhookSecret: string;
}

export interface IntegrationsData {
  unimake: UnimakeConfig;
  'focus-nfe': FocusNfeConfig;
  resend: ResendConfig;
  zapi: ZapiConfig;
}

const DEFAULTS: IntegrationsData = {
  unimake: {
    apiUrl: process.env.UNIMAKE_API_URL || 'https://api.unimake.com.br',
    apiKey: process.env.UNIMAKE_API_KEY || '',
    banco: process.env.UNIMAKE_BANCO || '756',
    agencia: process.env.UNIMAKE_AGENCIA || '',
    conta: process.env.UNIMAKE_CONTA || '',
    convenio: process.env.UNIMAKE_CONVENIO || '',
    carteira: process.env.UNIMAKE_CARTEIRA || '1',
    especie: process.env.UNIMAKE_ESPECIE || 'R$',
    instrucoes: process.env.UNIMAKE_INSTRUCOES || 'Não receber após vencimento',
    multaPercent: Number(process.env.UNIMAKE_MULTA_PERCENT || 2),
    jurosPercent: Number(process.env.UNIMAKE_JUROS_PERCENT || 1),
    webhookSecret: process.env.UNIMAKE_WEBHOOK_SECRET || '',
  },
  'focus-nfe': {
    baseUrl: process.env.FOCUS_NFE_BASE_URL || 'https://api.focusnfe.com.br',
    token: process.env.FOCUS_NFE_TOKEN || '',
    ambiente: (process.env.FOCUS_NFE_AMBIENTE as 'homologacao' | 'producao') || 'homologacao',
    refPadrao: process.env.FOCUS_NFE_REF_PADRAO || 'montsystem',
    automaticoNoPagamento: (process.env.FOCUS_NFE_AUTOMATICO_NO_PAGAMENTO || 'true') === 'true',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'Mont System <noreply@montsystem.com>',
  },
  zapi: {
    instanceId: process.env.ZAPI_INSTANCE_ID || '',
    token: process.env.ZAPI_TOKEN || '',
    clientToken: process.env.ZAPI_CLIENT_TOKEN || '',
    webhookSecret: process.env.ZAPI_WEBHOOK_SECRET || '',
  },
};

/** ID fixo do singleton — alinhado à migration. */
const INTEGRATIONS_SINGLETON_ID = '00000000-0000-0000-0000-000000000002';

/** Campos sensíveis que, se vierem mascarados do front, não devem sobrescrever o valor real. */
const SECRET_FIELDS: Record<IntegrationKey, string[]> = {
  unimake: ['apiKey', 'webhookSecret'],
  'focus-nfe': ['token'],
  resend: ['apiKey'],
  zapi: ['token', 'clientToken', 'webhookSecret'],
};

function isMaskedSecret(value: unknown): boolean {
  return typeof value === 'string' && value.includes('****');
}

function mergeIntegration<K extends IntegrationKey>(
  key: K,
  current: IntegrationsData[K],
  incoming: Partial<IntegrationsData[K]> | undefined,
): IntegrationsData[K] {
  if (!incoming) return { ...current };
  const next: any = { ...current, ...incoming };
  for (const field of SECRET_FIELDS[key]) {
    if (isMaskedSecret((incoming as any)[field])) {
      next[field] = (current as any)[field];
    }
  }
  return next;
}

function mergeAll(
  current: IntegrationsData,
  partial: Partial<IntegrationsData>,
): IntegrationsData {
  return {
    unimake: mergeIntegration('unimake', current.unimake, partial.unimake),
    'focus-nfe': mergeIntegration('focus-nfe', current['focus-nfe'], partial['focus-nfe']),
    resend: mergeIntegration('resend', current.resend, partial.resend),
    zapi: mergeIntegration('zapi', current.zapi, partial.zapi),
  };
}

function withDefaults(persisted: Partial<IntegrationsData> | null | undefined): IntegrationsData {
  return {
    unimake: { ...DEFAULTS.unimake, ...(persisted?.unimake || {}) },
    'focus-nfe': { ...DEFAULTS['focus-nfe'], ...(persisted?.['focus-nfe'] || {}) },
    resend: { ...DEFAULTS.resend, ...(persisted?.resend || {}) },
    zapi: { ...DEFAULTS.zapi, ...(persisted?.zapi || {}) },
  };
}

@Injectable()
export class IntegrationsStorage implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsStorage.name);
  /** Cache em memória — get/getOne permanecem síncronos para os consumidores. */
  private cache: IntegrationsData = { ...DEFAULTS };

  constructor(
    @InjectRepository(IntegrationSettings)
    private readonly repo: Repository<IntegrationSettings>,
  ) {}

  async onModuleInit() {
    await this.loadFromDb();
  }

  /**
   * Lê a config persistida no Postgres (com fallback legado para arquivo e defaults de env).
   */
  private async loadFromDb(): Promise<void> {
    try {
      let row = await this.repo.findOne({ where: { id: INTEGRATIONS_SINGLETON_ID } });

      // Migração one-shot: se o jsonb estiver vazio e existir integrations.json legado, importa.
      const persistedEmpty =
        !row?.data ||
        (typeof row.data === 'object' && Object.keys(row.data as object).length === 0);

      if (persistedEmpty) {
        const fromFile = this.readLegacyFile();
        if (fromFile) {
          const merged = withDefaults(fromFile);
          await this.persist(merged);
          this.cache = merged;
          this.logger.log('Integrações importadas de storage/config/integrations.json → Postgres');
          return;
        }
      }

      if (!row) {
        const initial = withDefaults(null);
        await this.persist(initial);
        this.cache = initial;
        return;
      }

      this.cache = withDefaults(row.data);
    } catch (e: any) {
      this.logger.warn(`Falha ao carregar integrações do Postgres: ${e?.message || e}`);
      this.cache = withDefaults(this.readLegacyFile());
    }
  }

  private readLegacyFile(): Partial<IntegrationsData> | null {
    try {
      const file = path.join(process.cwd(), 'storage', 'config', 'integrations.json');
      if (!fs.existsSync(file)) return null;
      const raw = fs.readFileSync(file, 'utf8');
      return JSON.parse(raw) as Partial<IntegrationsData>;
    } catch {
      return null;
    }
  }

  private async persist(data: IntegrationsData): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(IntegrationSettings)
      .values({ id: INTEGRATIONS_SINGLETON_ID, data })
      .orUpdate(['data'], ['id'])
      .execute();
  }

  get(): IntegrationsData {
    return {
      unimake: { ...this.cache.unimake },
      'focus-nfe': { ...this.cache['focus-nfe'] },
      resend: { ...this.cache.resend },
      zapi: { ...this.cache.zapi },
    };
  }

  getOne<K extends IntegrationKey>(key: K): IntegrationsData[K] {
    return { ...this.cache[key] };
  }

  async save(data: Partial<IntegrationsData>): Promise<IntegrationsData> {
    const merged = mergeAll(this.cache, data);
    await this.persist(merged);
    this.cache = merged;
    return this.get();
  }

  /**
   * Mascara campos sensíveis (apiKey, token, clientToken) para retorno ao frontend.
   */
  mask(data: IntegrationsData): IntegrationsData {
    return {
      unimake: {
        ...data.unimake,
        apiKey: data.unimake.apiKey ? maskKey(data.unimake.apiKey) : '',
        webhookSecret: data.unimake.webhookSecret ? maskKey(data.unimake.webhookSecret) : '',
      },
      'focus-nfe': {
        ...data['focus-nfe'],
        token: data['focus-nfe'].token ? maskKey(data['focus-nfe'].token) : '',
      },
      resend: { ...data.resend, apiKey: data.resend.apiKey ? maskKey(data.resend.apiKey) : '' },
      zapi: {
        ...data.zapi,
        token: data.zapi.token ? maskKey(data.zapi.token) : '',
        clientToken: data.zapi.clientToken ? maskKey(data.zapi.clientToken) : '',
        webhookSecret: data.zapi.webhookSecret ? maskKey(data.zapi.webhookSecret) : '',
      },
    };
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
