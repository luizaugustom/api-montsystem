import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { NfseEntity, NfseStatus, NfseProvider } from '../entities/nfse.entity';
import { IntegrationsStorage, FocusNfeConfig } from '../../integrations/integrations-storage';

export interface FocusNfeTomador {
  cpf_cnpj: string;
  razao_social: string;
  email?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    uf?: string;
    codigo_municipio?: string;
    municipio?: string;
  };
}

export interface FocusNfeServico {
  aliquota: number;
  base_calculo?: number;
  codigo_municipio?: string;
  codigo_tributario_municipio?: string;
  descricao: string;
  iss_retido?: boolean;
  item_lista_servico?: string;
  valor_iss?: number;
  valor_servicos: number;
}

export interface FocusNfePayload {
  ref?: string;
  data_emissao?: string; // YYYY-MM-DD
  data_competencia?: string;
  prestador?: {
    cnpj: string;
    inscricao_municipal?: string;
    codigo_municipio: string;
  };
  tomador: FocusNfeTomador;
  servico: FocusNfeServico;
  optante_simples_nacional?: boolean;
  incentivador_cultural?: boolean;
  outras_informacoes?: string;
}

export interface FocusNfeResponse {
  status: string; // 'processando' | 'autorizado' | 'rejeitado' | 'cancelado' | 'erro'
  ref?: string;
  numero?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  url?: string; // URL do DANFSe
  url_xml?: string;
  mensagem?: string;
  erros?: Array<{ mensagem?: string; codigo?: string }>;
}

@Injectable()
export class FocusNfeService {
  private readonly logger = new Logger(FocusNfeService.name);

  constructor(
    @InjectRepository(NfseEntity)
    private repo: Repository<NfseEntity>,
    private storage: IntegrationsStorage,
  ) {}

  private getConfig(): FocusNfeConfig {
    return this.storage.getOne('focus-nfe');
  }

  private getClient(): AxiosInstance {
    const cfg = this.getConfig();
    if (!cfg.token) {
      throw new BadRequestException('Focus NFe não configurado (defina FOCUS_NFE_TOKEN em /integracoes)');
    }
    const auth = Buffer.from(`${cfg.token}:`).toString('base64');
    const baseURL = cfg.ambiente === 'producao'
      ? cfg.baseUrl
      : cfg.baseUrl; // mesmo host; ambiente diferencia o certificado
    return axios.create({
      baseURL,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Emite uma NFSe. Cria registro NfseEntity antes do envio.
   */
  async emitir(payload: FocusNfePayload, opts?: { monthlyChargeId?: string; invoiceId?: number; prestadorCnpj?: string; prestadorIM?: string; prestadorMunicipio?: string }): Promise<NfseEntity> {
    const cfg = this.getConfig();
    if (!cfg.token) throw new BadRequestException('Focus NFe não configurado');

    const ref = payload.ref || `${cfg.refPadrao}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Monta prestador a partir do payload ou dos opts
    const prestador = payload.prestador || {
      cnpj: (opts?.prestadorCnpj || '').replace(/\D/g, ''),
      inscricao_municipal: opts?.prestadorIM,
      codigo_municipio: opts?.prestadorMunicipio || '3550308',
    };

    const finalPayload: any = {
      ...payload,
      ref,
      prestador,
      data_emissao: payload.data_emissao || new Date().toISOString().slice(0, 10),
    };

    // Salva registro inicial (status processing)
    const record = this.repo.create({
      ref,
      provider: NfseProvider.FOCUS_NFE,
      status: NfseStatus.PROCESSING,
      xml: '', // XML só vem após autorização
      payloadJson: finalPayload,
      monthlyChargeId: opts?.monthlyChargeId,
      invoiceId: opts?.invoiceId,
    });
    await this.repo.save(record);

    try {
      const client = this.getClient();
      const res = await client.post<FocusNfeResponse>(`/v2/nfse?ref=${encodeURIComponent(ref)}`, finalPayload, {
        validateStatus: () => true,
      });

      if (res.status >= 200 && res.status < 300) {
        const body = res.data as FocusNfeResponse;
        const status = this.mapStatus(body.status);
        record.status = status;
        record.protocolo = body.codigo_verificacao || undefined;
        record.nfseNumber = body.numero || undefined;
        record.urlPdf = body.url || undefined;
        record.urlXml = body.url_xml || undefined;
        record.response = JSON.stringify(body);
        if (status === NfseStatus.AUTHORIZED && body.url_xml) {
          // Baixa o XML autorizado para anexar em email etc.
          try {
            const xmlRes = await client.get(body.url_xml, { responseType: 'text', validateStatus: () => true });
            if (xmlRes.status === 200) record.xml = xmlRes.data as string;
          } catch (e: any) {
            this.logger.warn(`Falha ao baixar XML: ${e?.message}`);
          }
        }
        if (status === NfseStatus.REJECTED || status === NfseStatus.ERROR) {
          record.rejectionReason = body.mensagem || (body.erros || []).map(e => e.mensagem).filter(Boolean).join('; ');
        }
        await this.repo.save(record);
        return record;
      }

      // Erro HTTP
      record.status = NfseStatus.ERROR;
      record.rejectionReason = `HTTP ${res.status}: ${JSON.stringify(res.data)}`;
      record.response = JSON.stringify(res.data);
      await this.repo.save(record);
      return record;
    } catch (e: any) {
      record.status = NfseStatus.ERROR;
      record.rejectionReason = e?.message || 'Erro desconhecido';
      await this.repo.save(record);
      this.logger.error(`Erro Focus NFe: ${e?.message}`);
      return record;
    }
  }

  async consultar(ref: string): Promise<FocusNfeResponse> {
    const client = this.getClient();
    const res = await client.get(`/v2/nfse/${encodeURIComponent(ref)}`, { validateStatus: () => true });
    if (res.status === 200) {
      const body = res.data as FocusNfeResponse;
      // Atualiza registro se encontrado
      const existing = await this.repo.findOne({ where: { ref } as any });
      if (existing) {
        const status = this.mapStatus(body.status);
        existing.status = status;
        existing.protocolo = body.codigo_verificacao || existing.protocolo;
        existing.nfseNumber = body.numero || existing.nfseNumber;
        existing.urlPdf = body.url || existing.urlPdf;
        existing.urlXml = body.url_xml || existing.urlXml;
        existing.response = JSON.stringify(body);
        if (body.url_xml && !existing.xml) {
          try {
            const xmlRes = await client.get(body.url_xml, { responseType: 'text', validateStatus: () => true });
            if (xmlRes.status === 200) existing.xml = xmlRes.data as string;
          } catch (e: any) {
            this.logger.warn(`Falha ao baixar XML na consulta: ${e?.message}`);
          }
        }
        await this.repo.save(existing);
      }
      return body;
    }
    return { status: 'erro', mensagem: `HTTP ${res.status}`, erros: [res.data] } as any;
  }

  async cancelar(ref: string, justificativa: string): Promise<FocusNfeResponse> {
    const client = this.getClient();
    const res = await client.delete(`/v2/nfse/${encodeURIComponent(ref)}`, {
      data: { justificativa },
      validateStatus: () => true,
    });
    if (res.status === 200) {
      const body = res.data as FocusNfeResponse;
      const existing = await this.repo.findOne({ where: { ref } as any });
      if (existing) {
        existing.status = this.mapStatus(body.status);
        existing.rejectionReason = justificativa;
        await this.repo.save(existing);
      }
      return body;
    }
    return { status: 'erro', mensagem: `HTTP ${res.status}` } as any;
  }

  async findById(id: number): Promise<NfseEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async listAll(opts?: { monthlyChargeId?: string; invoiceId?: number }) {
    const where: any = {};
    if (opts?.monthlyChargeId) where.monthlyChargeId = opts.monthlyChargeId;
    if (opts?.invoiceId) where.invoiceId = opts.invoiceId;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  private mapStatus(s: string): string {
    const normalized = (s || '').toLowerCase();
    if (normalized.includes('autoriz')) return NfseStatus.AUTHORIZED;
    if (normalized.includes('cancel')) return NfseStatus.CANCELLED;
    if (normalized.includes('rejeit')) return NfseStatus.REJECTED;
    if (normalized.includes('erro')) return NfseStatus.ERROR;
    return NfseStatus.PROCESSING;
  }
}
