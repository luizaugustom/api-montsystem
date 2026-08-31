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
      throw new BadRequestException(
        'Evolution API não configurada. Defina EVOLUTION_API_KEY no .env, salve em /integracoes, ' +
          'ou rode `docker compose up bootstrap-secrets` (gera ./secrets/evolution.env automaticamente).',
      );
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
   * Verifica quais números possuem WhatsApp (camada anti-ban).
   * Retorna { valid: phones[], invalid: phones[] }.
   */
  async checkWhatsappNumbers(phones: string[]): Promise<{ valid: string[]; invalid: string[]; skipped: boolean }> {
    if (!this.isConfigured()) return { valid: phones, invalid: [], skipped: true };
    const cfg = this.getConfig();
    const client = this.requireClient();
    try {
      const res = await client.post(`/chat/whatsappNumbers/${cfg.instance}`, { numbers: phones }, { validateStatus: () => true });
      if (res.status < 200 || res.status >= 300) {
        this.logger.warn(`checkWhatsappNumbers HTTP ${res.status}`);
        return { valid: phones, invalid: [], skipped: true };
      }
      const data = res.data;
      if (!Array.isArray(data)) return { valid: phones, invalid: [], skipped: true };
      const valid: string[] = [];
      const invalid: string[] = [];
      for (const entry of data) {
        const num = String(entry?.number || '').replace(/\D/g, '');
        if (entry?.exists === true) valid.push(num);
        else invalid.push(num);
      }
      return { valid, invalid, skipped: false };
    } catch (e: any) {
      this.logger.warn(`checkWhatsappNumbers erro: ${e?.message}`);
      return { valid: phones, invalid: [], skipped: true };
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
   * Inicia (ou retorna) o QR code de pareamento da instância.
   * Quando a instância já está `open`, a Evolution retorna o estado atual em
   * `data.instance.state` — sem QR.
   *
   * Resposta típica da Evolution v2 quando ainda não conectada:
   *   { pairingCode, code, base64, count }
   * onde `base64` é uma data URL `data:image/png;base64,...` pronta para `<img src>`.
   */
  async connectInstance(): Promise<{
    connected: boolean;
    state?: string;
    pairingCode?: string;
    code?: string;
    base64?: string;
    data?: any;
  }> {
    const cfg = this.getConfig();
    const client = this.requireClient();
    try {
      const res = await client.get(`/instance/connect/${cfg.instance}`, { validateStatus: () => true });
      if (res.status === 200) {
        const body = res.data || {};
        const state = body?.instance?.state || 'unknown';
        return {
          connected: state === 'open',
          state,
          pairingCode: body.pairingCode,
          code: body.code,
          base64: body.base64,
          data: body,
        };
      }
      if (res.status === 404) {
        return { connected: false, state: 'not_found', data: res.data };
      }
      return { connected: false, state: 'error', data: res.data };
    } catch (e: any) {
      this.logger.warn(`Evolution connect falhou: ${e?.message}`);
      return { connected: false, state: 'unreachable', data: { error: e?.message } };
    }
  }

  /**
   * Desconecta (logout) a instância WhatsApp.
   * Útil para o usuário reiniciar o pareamento sem recriar a instância.
   */
  async logoutInstance(): Promise<{ ok: boolean; data?: any; error?: string }> {
    const cfg = this.getConfig();
    const client = this.requireClient();
    try {
      const res = await client.delete(`/instance/logout/${cfg.instance}`, { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, data: res.data };
      }
      return { ok: false, error: `HTTP ${res.status}`, data: res.data };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro' };
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
