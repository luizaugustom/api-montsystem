import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IntegrationsStorage, UnimakeConfig } from '../../modules/integrations/integrations-storage';

export interface UnimakeEmitirPayload {
  // identificação
  nossoNumero?: string;
  numeroDocumento?: string;
  // dados do pagador
  pagador: {
    nome: string;
    cpfCnpj: string;
    email?: string;
    telefone?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      complemento?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
    };
  };
  // dados do boleto
  valor: number;
  vencimento: string; // YYYY-MM-DD
  especie?: string;
  instrucoes?: string[];
  multaPercent?: number;
  jurosPercent?: number;
  // metadados opcionais
  descricao?: string;
  referencia?: string;
}

export interface UnimakeEmitirResponse {
  nossoNumero: string;
  linhaDigitavel: string;
  codigoBarras: string;
  urlPdf?: string;
  urlXml?: string;
  id?: string;
  mensagem?: string;
  sucesso: boolean;
}

@Injectable()
export class UnimakeService implements OnModuleInit {
  private readonly logger = new Logger(UnimakeService.name);
  private client: AxiosInstance | null = null;
  private currentKey: string | null = null;

  constructor(private storage: IntegrationsStorage) {}

  onModuleInit() {
    this.refresh();
  }

  refresh() {
    const cfg = this.storage.getOne('unimake');
    if (cfg.apiKey !== this.currentKey) {
      this.client = cfg.apiKey
        ? axios.create({
            baseURL: cfg.apiUrl.replace(/\/$/, ''),
            headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
            timeout: 30000,
          })
        : null;
      this.currentKey = cfg.apiKey;
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getConfig(): UnimakeConfig {
    return this.storage.getOne('unimake');
  }

  private requireClient(): AxiosInstance {
    this.refresh();
    if (!this.client) {
      throw new BadRequestException('Unimake não configurada (defina UNIMAKE_API_KEY em /integracoes)');
    }
    return this.client;
  }

  /**
   * Emite boleto via API Unimake. O endpoint exato pode variar conforme banco/convenio;
   * aqui usamos /boletos como caminho padrão. A chamada inclui os dados bancários da config.
   */
  async emitirBoleto(payload: UnimakeEmitirPayload): Promise<UnimakeEmitirResponse> {
    const cfg = this.getConfig();
    if (!cfg.apiKey) throw new BadRequestException('Unimake não configurada');
    if (!cfg.agencia || !cfg.conta || !cfg.convenio) {
      throw new BadRequestException('Config bancária incompleta (agencia/conta/convenio)');
    }

    const client = this.requireClient();

    const body = {
      banco: cfg.banco,
      agencia: cfg.agencia,
      conta: cfg.conta,
      convenio: cfg.convenio,
      carteira: cfg.carteira,
      nossoNumero: payload.nossoNumero,
      numeroDocumento: payload.numeroDocumento,
      pagador: payload.pagador,
      valor: payload.valor,
      vencimento: payload.vencimento,
      especie: payload.especie || cfg.especie,
      instrucoes: payload.instrucoes || [cfg.instrucoes],
      multaPercent: payload.multaPercent ?? cfg.multaPercent,
      jurosPercent: payload.jurosPercent ?? cfg.jurosPercent,
      descricao: payload.descricao,
      referencia: payload.referencia,
    };

    try {
      const res = await client.post('/boletos', body, { validateStatus: () => true });
      if (res.status >= 200 && res.status < 300) {
        const data = res.data || {};
        return {
          nossoNumero: data.nossoNumero || payload.nossoNumero || '',
          linhaDigitavel: data.linhaDigitavel || '',
          codigoBarras: data.codigoBarras || '',
          urlPdf: data.urlPdf || data.pdf,
          urlXml: data.urlXml || data.xml,
          id: data.id,
          mensagem: data.mensagem,
          sucesso: true,
        };
      }
      return {
        nossoNumero: payload.nossoNumero || '',
        linhaDigitavel: '',
        codigoBarras: '',
        mensagem: typeof res.data === 'string' ? res.data : JSON.stringify(res.data),
        sucesso: false,
      };
    } catch (e: any) {
      this.logger.error(`Unimake emitir falhou: ${e?.message}`);
      return {
        nossoNumero: payload.nossoNumero || '',
        linhaDigitavel: '',
        codigoBarras: '',
        mensagem: e?.message || 'Erro de rede',
        sucesso: false,
      };
    }
  }

  /**
   * Consulta status de um boleto pelo nosso número.
   */
  async consultarBoleto(nossoNumero: string): Promise<{ situacao: string; valorPago?: number; dataPagamento?: string; raw: any }> {
    const client = this.requireClient();
    const cfg = this.getConfig();
    try {
      const res = await client.get(`/boletos/${encodeURIComponent(nossoNumero)}`, {
        params: { banco: cfg.banco, agencia: cfg.agencia, conta: cfg.conta, convenio: cfg.convenio },
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const data = res.data || {};
        return {
          situacao: data.situacao || data.status || 'desconhecida',
          valorPago: data.valorPago,
          dataPagamento: data.dataPagamento,
          raw: data,
        };
      }
      return { situacao: 'erro', raw: res.data };
    } catch (e: any) {
      this.logger.warn(`Unimake consultar falhou: ${e?.message}`);
      return { situacao: 'erro', raw: { error: e?.message } };
    }
  }

  /**
   * Cancela um boleto (baixa) na Unimake.
   */
  async cancelarBoleto(nossoNumero: string): Promise<{ sucesso: boolean; mensagem?: string }> {
    const client = this.requireClient();
    try {
      const res = await client.delete(`/boletos/${encodeURIComponent(nossoNumero)}`, { validateStatus: () => true });
      return {
        sucesso: res.status >= 200 && res.status < 300,
        mensagem: res.status >= 200 && res.status < 300 ? 'Boleto cancelado' : JSON.stringify(res.data),
      };
    } catch (e: any) {
      return { sucesso: false, mensagem: e?.message };
    }
  }

  /**
   * Baixa o PDF do boleto para cache local (storage/boletos/pdf/).
   */
  async downloadPdf(url: string, destPath: string): Promise<boolean> {
    if (!url) return false;
    const client = this.requireClient();
    try {
      const res = await client.get(url, { responseType: 'arraybuffer', validateStatus: () => true });
      if (res.status === 200) {
        const fs = await import('fs/promises');
        const path = await import('path');
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, Buffer.from(res.data));
        return true;
      }
    } catch (e: any) {
      this.logger.warn(`Falha ao baixar PDF do boleto: ${e?.message}`);
    }
    return false;
  }
}
