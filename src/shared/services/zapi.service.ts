import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IntegrationsStorage, ZapiConfig } from '../../modules/integrations/integrations-storage';

export interface ZapiSendTextPayload {
  phone: string;
  message: string;
  delay?: number;
  delayTyping?: number;
}

export interface ZapiSendMediaPayload {
  phone: string;
  mediatype: 'image' | 'document' | 'audio' | 'video';
  media: string; // URL ou base64
  fileName?: string;
  caption?: string;
  delay?: number;
  delayTyping?: number;
}

export interface ZapiApiResponse {
  zaapId?: string;
  messageId?: string;
  id?: string;
  error?: string;
  response?: any;
}

const BASE_URL = 'https://api.z-api.io';

@Injectable()
export class ZapiService {
  private readonly logger = new Logger(ZapiService.name);
  private client: AxiosInstance;
  private cachedClientToken: string | null | undefined = undefined;

  constructor(private storage: IntegrationsStorage) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  }

  /**
   * Helper central: monta a URL path-based da Z-API, com credenciais embutidas.
   * `https://api.z-api.io/instances/{id}/token/{t}{action}`
   */
  private urlFor(path: string): string {
    const cfg = this.getConfig();
    return `/instances/${cfg.instanceId}/token/${cfg.token}${path}`;
  }

  /**
   * Mantém o header `Client-Token` sincronizado com o config atual.
   * Idempotente e barato — chamado no início de cada método público.
   */
  private refresh() {
    const cfg = this.getConfig();
    if (cfg.clientToken !== this.cachedClientToken) {
      const token = cfg.clientToken;
      if (token) {
        this.client.defaults.headers['Client-Token'] = token;
      } else {
        delete this.client.defaults.headers['Client-Token'];
      }
      this.cachedClientToken = cfg.clientToken;
    }
  }

  isConfigured(): boolean {
    const cfg = this.getConfig();
    return !!cfg.instanceId && !!cfg.token;
  }

  getConfig(): ZapiConfig {
    return this.storage.getOne('zapi');
  }

  private requireConfig(): ZapiConfig {
    const cfg = this.getConfig();
    if (!cfg.instanceId || !cfg.token) {
      throw new BadRequestException(
        'Z-API não configurada. Defina Instance ID e Token em /integracoes.',
      );
    }
    return cfg;
  }

  /**
   * Envia mensagem de texto via Z-API.
   * Defaults anti-ban: delay e delayTyping de 2s quando não fornecidos.
   */
  async sendText(payload: ZapiSendTextPayload): Promise<ZapiApiResponse> {
    this.refresh();
    this.requireConfig();
    try {
      const body = {
        phone: payload.phone,
        message: payload.message,
        delay: payload.delay ?? 2,
        delayTyping: payload.delayTyping ?? 2,
      };
      const res = await this.client.post<any>(this.urlFor('/send-text'), body, {
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return {
          zaapId: res.data?.zaapId,
          messageId: res.data?.messageId,
          id: res.data?.id,
        };
      }
      return { error: `HTTP ${res.status}`, response: res.data };
    } catch (e: any) {
      this.logger.error(`Z-API sendText falhou: ${e?.message}`);
      return { error: e?.message || 'Erro' };
    }
  }

  /**
   * Envia mídia (imagem/documento/áudio/vídeo) via Z-API.
   * Cada tipo tem um endpoint dedicado; aqui só roteamos para o correto.
   */
  async sendMedia(payload: ZapiSendMediaPayload): Promise<ZapiApiResponse> {
    this.refresh();
    this.requireConfig();
    const action =
      payload.mediatype === 'image'
        ? '/send-message-image'
        : payload.mediatype === 'document'
          ? '/send-message-document'
          : payload.mediatype === 'audio'
            ? '/send-message-audio'
            : '/send-message-video';
    const mediaKey =
      payload.mediatype === 'image'
        ? 'image'
        : payload.mediatype === 'document'
          ? 'document'
          : payload.mediatype === 'audio'
            ? 'audio'
            : 'video';
    try {
      const body: any = {
        phone: payload.phone,
        [mediaKey]: payload.media,
        delay: payload.delay ?? 2,
        delayTyping: payload.delayTyping ?? 2,
      };
      if (payload.caption) body.caption = payload.caption;
      if (payload.fileName) body.fileName = payload.fileName;
      const res = await this.client.post<any>(this.urlFor(action), body, {
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return {
          zaapId: res.data?.zaapId,
          messageId: res.data?.messageId,
          id: res.data?.id,
        };
      }
      return { error: `HTTP ${res.status}`, response: res.data };
    } catch (e: any) {
      this.logger.error(`Z-API sendMedia falhou: ${e?.message}`);
      return { error: e?.message || 'Erro' };
    }
  }

  /**
   * Z-API NÃO expõe um endpoint para checagem em lote de "este número tem WhatsApp?".
   * A camada anti-ban assume `skipped: true` silenciosamente, deixando o envio prosseguir.
   * O número inválido será marcado como FAILED quando o provider recusar (ver webhook).
   */
  async checkWhatsappNumbers(
    _phones: string[],
  ): Promise<{ valid: string[]; invalid: string[]; skipped: boolean }> {
    return { valid: [], invalid: [], skipped: true };
  }

  /**
   * Verifica status da instância na Z-API.
   * Endpoint: GET /status → { connected, smartphoneConnected, error }.
   * Devolve `{ state }` nos mesmos strings usados pelo frontend
   * ('open' | 'close' | 'connecting' | 'error' | 'unreachable').
   */
  async getInstanceState(): Promise<{ state: string; data?: any }> {
    this.refresh();
    if (!this.isConfigured()) return { state: 'close', data: { error: 'Não configurado' } };
    try {
      const res = await this.client.get<any>(this.urlFor('/status'), {
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) {
        return { state: 'unreachable', data: { error: `HTTP ${res.status}` } };
      }
      if (res.status !== 200) {
        return { state: 'error', data: res.data };
      }
      const body = res.data || {};
      // Leitura defensiva: docs da Z-API tem typo `smarthphoneConnected` em alguns lugares
      const connected = body.connected === true;
      const smartphoneConnected =
        body.smartphoneConnected === true || body.smarthphoneConnected === true;
      const errorFlag = body.error === true;
      let state: string;
      if (errorFlag) state = 'error';
      else if (connected && smartphoneConnected) state = 'open';
      else if (connected && !smartphoneConnected) state = 'connecting';
      else state = 'close';
      return { state, data: body };
    } catch (e: any) {
      return { state: 'unreachable', data: { error: e?.message } };
    }
  }

  /**
   * Retorna o QR code de pareamento. Quando a instância já está conectada,
   * retorna `{ connected: true, state: 'open' }` sem QR.
   *
   * O QR da Z-API expira a cada ~20s. Se o provider responder 204 (sem novo QR),
   * mantemos o base64 anterior.
   */
  async getQr(currentBase64?: string): Promise<{
    connected: boolean;
    state?: string;
    base64?: string;
    data?: any;
  }> {
    this.refresh();
    if (!this.isConfigured()) return { connected: false, state: 'close' };
    try {
      const res = await this.client.get<any>(this.urlFor('/qr-code'), {
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const body = res.data || {};
        const base64 = body.value || body.base64 || body.code || currentBase64;
        return { connected: false, state: 'connecting', base64 };
      }
      // 204 = nenhum QR novo (o anterior ainda é válido)
      if (res.status === 204 && currentBase64) {
        return { connected: false, state: 'connecting', base64: currentBase64 };
      }
      if (res.status === 401 || res.status === 403) {
        return { connected: false, state: 'unreachable', data: { error: `HTTP ${res.status}` } };
      }
      return { connected: false, state: 'error', data: res.data };
    } catch (e: any) {
      this.logger.warn(`Z-API getQr falhou: ${e?.message}`);
      return { connected: false, state: 'unreachable', data: { error: e?.message } };
    }
  }

  /**
   * Desconecta (logout) a instância. Após isso, o próximo `getQr()`
   * retorna um QR novo.
   */
  async logoutInstance(): Promise<{ ok: boolean; data?: any; error?: string }> {
    this.refresh();
    if (!this.isConfigured()) return { ok: false, error: 'Não configurado' };
    try {
      const res = await this.client.post(this.urlFor('/disconnect'), {}, {
        validateStatus: () => true,
      });
      if (res.status >= 200 && res.status < 300) {
        return { ok: true, data: res.data };
      }
      return { ok: false, error: `HTTP ${res.status}`, data: res.data };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Erro' };
    }
  }

  /**
   * Normaliza um número BR para o formato exigido pela Z-API (55 + DDD + número, só dígitos).
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