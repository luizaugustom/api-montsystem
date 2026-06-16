import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IntegrationsStorage, EvolutionConfig } from '../../modules/integrations/integrations-storage';

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
  delay?: number;
}

export interface EvolutionSendMediaPayload {
  number: string;
  mediatype: 'image' | 'document' | 'audio' | 'video';
  media: string; // URL ou base64
  fileName?: string;
  caption?: string;
}

export interface EvolutionApiResponse {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string };
  message?: any;
  status?: number;
  error?: string;
  response?: any;
}

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private client: AxiosInstance | null = null;
  private currentKey: string | null = null;

  constructor(private storage: IntegrationsStorage) {
    this.refresh();
  }

  refresh() {
    const cfg = this.storage.getOne('evolution');
    if (cfg.apiKey !== this.currentKey) {
      this.client = cfg.apiKey
        ? axios.create({
            baseURL: cfg.baseUrl.replace(/\/$/, ''),
            headers: { apikey: cfg.apiKey, 'Content-Type': 'application/json' },
            timeout: 30000,
          })
        : null;
      this.currentKey = cfg.apiKey;
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getConfig(): EvolutionConfig {
    return this.storage.getOne('evolution');
  }

  private requireClient(): AxiosInstance {
    if (!this.client) {
      throw new BadRequestException('Evolution API não configurada (defina EVOLUTION_API_KEY em /integracoes)');
    }
    return this.client;
  }

  /**
   * Envia mensagem de texto via Evolution API.
   */
  async sendText(payload: EvolutionSendTextPayload): Promise<EvolutionApiResponse> {
    const cfg = this.getConfig();
    const client = this.requireClient();
    const url = `/message/sendText/${cfg.instance}`;
    try {
      const res = await client.post<EvolutionApiResponse>(url, payload, { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return res.data;
      }
      return { error: `HTTP ${res.status}`, response: res.data };
    } catch (e: any) {
      this.logger.error(`Evolution sendText falhou: ${e?.message}`);
      return { error: e?.message || 'Erro' };
    }
  }

  /**
   * Envia mídia (PDF, imagem etc) via Evolution API.
   */
  async sendMedia(payload: EvolutionSendMediaPayload): Promise<EvolutionApiResponse> {
    const cfg = this.getConfig();
    const client = this.requireClient();
    const url = `/message/sendMedia/${cfg.instance}`;
    try {
      const res = await client.post<EvolutionApiResponse>(url, payload, { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return res.data;
      }
      return { error: `HTTP ${res.status}`, response: res.data };
    } catch (e: any) {
      this.logger.error(`Evolution sendMedia falhou: ${e?.message}`);
      return { error: e?.message || 'Erro' };
    }
  }

  /**
   * Verifica status de conexão da instância.
   */
  async getInstanceState(): Promise<{ state: string; data?: any }> {
    const cfg = this.getConfig();
    const client = this.requireClient();
    try {
      const res = await client.get(`/instance/connectionState/${cfg.instance}`, { validateStatus: () => true });
      if (res.status === 200) {
        const state = res.data?.instance?.state || res.data?.state || 'unknown';
        return { state, data: res.data };
      }
      return { state: 'error', data: res.data };
    } catch (e: any) {
      return { state: 'unreachable', data: { error: e?.message } };
    }
  }

  /**
   * Normaliza um número BR para o formato exigido pelo WhatsApp (55 + DDD + número).
   */
  static normalizePhone(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    // assume BR se não tem código de país e tem 10-11 dígitos
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  }
}
