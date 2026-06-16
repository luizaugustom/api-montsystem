import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type IntegrationKey = 'unimake' | 'focus-nfe' | 'resend' | 'evolution';

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

export interface EvolutionConfig {
  baseUrl: string;
  instance: string;
  apiKey: string;
  webhookSecret: string;
}

export interface IntegrationsData {
  unimake: UnimakeConfig;
  'focus-nfe': FocusNfeConfig;
  resend: ResendConfig;
  evolution: EvolutionConfig;
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
  evolution: {
    baseUrl: process.env.EVOLUTION_BASE_URL || 'http://evolution:8080',
    instance: process.env.EVOLUTION_INSTANCE || 'montsystem',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    webhookSecret: process.env.EVOLUTION_WEBHOOK_SECRET || '',
  },
};

@Injectable()
export class IntegrationsStorage {
  private getConfigPath(): string {
    const dir = path.join(process.cwd(), 'storage', 'config');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'integrations.json');
  }

  /**
   * Lê a config persistida e mescla com defaults vindos de env (env sempre perde para o arquivo persistido).
   */
  get(): IntegrationsData {
    const file = this.getConfigPath();
    if (!fs.existsSync(file)) return { ...DEFAULTS };
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const persisted = JSON.parse(raw) as Partial<IntegrationsData>;
      // Merge cada chave individualmente
      return {
        unimake: { ...DEFAULTS.unimake, ...(persisted.unimake || {}) },
        'focus-nfe': { ...DEFAULTS['focus-nfe'], ...(persisted['focus-nfe'] || {}) },
        resend: { ...DEFAULTS.resend, ...(persisted.resend || {}) },
        evolution: { ...DEFAULTS.evolution, ...(persisted.evolution || {}) },
      };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  getOne<K extends IntegrationKey>(key: K): IntegrationsData[K] {
    return this.get()[key];
  }

  save(data: Partial<IntegrationsData>): IntegrationsData {
    const current = this.get();
    const merged: IntegrationsData = {
      unimake: { ...current.unimake, ...(data.unimake || {}) },
      'focus-nfe': { ...current['focus-nfe'], ...(data['focus-nfe'] || {}) },
      resend: { ...current.resend, ...(data.resend || {}) },
      evolution: { ...current.evolution, ...(data.evolution || {}) },
    };
    const file = this.getConfigPath();
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }

  /**
   * Mascara campos sensíveis (apiKey, token) para retorno ao frontend.
   */
  mask(data: IntegrationsData): IntegrationsData {
    return {
      unimake: { ...data.unimake, apiKey: data.unimake.apiKey ? maskKey(data.unimake.apiKey) : '' },
      'focus-nfe': { ...data['focus-nfe'], token: data['focus-nfe'].token ? maskKey(data['focus-nfe'].token) : '' },
      resend: { ...data.resend, apiKey: data.resend.apiKey ? maskKey(data.resend.apiKey) : '' },
      evolution: { ...data.evolution, apiKey: data.evolution.apiKey ? maskKey(data.evolution.apiKey) : '' },
    };
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}
