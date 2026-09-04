import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { IntegrationsStorage, IntegrationKey, IntegrationsData } from './integrations-storage';

@Injectable()
export class IntegrationsService {
  constructor(private storage: IntegrationsStorage) {}

  getAll(mask = true) {
    const data = this.storage.get();
    return mask ? this.storage.mask(data) : data;
  }

  getOne(key: IntegrationKey) {
    return this.storage.getOne(key);
  }

  save(key: IntegrationKey, partial: any): IntegrationsData {
    return this.storage.save({ [key]: partial } as Partial<IntegrationsData>);
  }

  /**
   * Testa a conexão com cada provedor.
   */
  async testConnection(key: IntegrationKey): Promise<{ ok: boolean; message: string; details?: any }> {
    const cfg = this.storage.getOne(key);
    try {
      switch (key) {
        case 'unimake':
          return await this.testUnimake(cfg as any);
        case 'focus-nfe':
          return await this.testFocusNfe(cfg as any);
        case 'resend':
          return await this.testResend(cfg as any);
        case 'zapi':
          return await this.testZapi(cfg as any);
        default:
          return { ok: false, message: 'Integração desconhecida' };
      }
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Erro ao testar conexão' };
    }
  }

  private async testUnimake(cfg: { apiUrl: string; apiKey: string }): Promise<{ ok: boolean; message: string; details?: any }> {
    if (!cfg.apiKey) return { ok: false, message: 'API key não configurada' };
    try {
      // A maioria dos endpoints Unimake exige POST; para "test" basta validar o endpoint base.
      // Tenta OPTIONS/HEAD primeiro, depois fallback para um endpoint leve.
      const res = await axios.get(`${cfg.apiUrl.replace(/\/$/, '')}/`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        timeout: 8000,
        validateStatus: () => true,
      });
      // Considera OK qualquer resposta (mesmo 404) que não seja 401/403
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'API key inválida ou sem permissão', details: { status: res.status } };
      }
      return { ok: true, message: `Endpoint Unimake acessível (status ${res.status})`, details: { status: res.status } };
    } catch (e: any) {
      return { ok: false, message: `Falha de rede: ${e?.message || e}` };
    }
  }

  private async testFocusNfe(cfg: { baseUrl: string; token: string; ambiente: string }): Promise<{ ok: boolean; message: string; details?: any }> {
    if (!cfg.token) return { ok: false, message: 'Token não configurado' };
    try {
      // Focus NFe expõe GET /v2/{ref}/{path} para consulta. Chamada mais leve: listar empresa.
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/v2/empresa`;
      const auth = Buffer.from(`${cfg.token}:`).toString('base64');
      const res = await axios.get(url, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 8000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'Token Focus NFe inválido', details: { status: res.status } };
      }
      return { ok: true, message: `Focus NFe respondeu ${res.status}`, details: { status: res.status } };
    } catch (e: any) {
      return { ok: false, message: `Falha de rede: ${e?.message || e}` };
    }
  }

  private async testResend(cfg: { apiKey: string; from: string }): Promise<{ ok: boolean; message: string }> {
    if (!cfg.apiKey) return { ok: false, message: 'API key não configurada' };
    try {
      const res = await axios.get('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
        timeout: 8000,
        validateStatus: () => true,
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'API key Resend inválida' };
      }
      return { ok: true, message: 'API key Resend válida' };
    } catch (e: any) {
      return { ok: false, message: `Falha de rede: ${e?.message || e}` };
    }
  }

  private async testZapi(cfg: { instanceId: string; token: string; clientToken: string }): Promise<{ ok: boolean; message: string; details?: any }> {
    if (!cfg.instanceId || !cfg.token) {
      return { ok: false, message: 'Instance ID e Token são obrigatórios' };
    }
    const url = `https://api.z-api.io/instances/${cfg.instanceId}/token/${cfg.token}/status`;
    const headers: Record<string, string> = {};
    if (cfg.clientToken) headers['Client-Token'] = cfg.clientToken;
    try {
      const res = await axios.get(url, { headers, timeout: 8000, validateStatus: () => true });
      if (res.status === 200) {
        return { ok: true, message: 'Conectado à Z-API', details: res.data };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, message: 'Token ou Client-Token inválido', details: res.data };
      }
      return { ok: false, message: `Falha ao contatar Z-API (status ${res.status})`, details: res.data };
    } catch (e: any) {
      return { ok: false, message: `Falha de rede: ${e?.message || e}` };
    }
  }
}
