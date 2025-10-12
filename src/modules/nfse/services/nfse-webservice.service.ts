import { Injectable, Logger } from '@nestjs/common';
import { NfseConfigService } from './nfse-config.service';
import { NfseSignatureService } from './nfse-signature.service';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { NfseEntity } from '../entities/nfse.entity';

@Injectable()
export class NfseWebServiceService {
  private readonly logger = new Logger(NfseWebServiceService.name);
  constructor(private cfg: NfseConfigService, private signer: NfseSignatureService, @InjectRepository(NfseEntity) private nfseRepo?: Repository<NfseEntity>) {}

  private buildGinfesEnvelope(rpsXml: string) {
    // Envelope simples para envio de lote RPS — adaptar conforme WSDL/versão do provedor
    return `<?xml version="1.0" encoding="UTF-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gin="http://www.ginfes.com.br/">
      <soapenv:Header/>
      <soapenv:Body>
        <gin:RecepcionarLoteRpsEnvio>
          <gin:ListaRps>
            ${rpsXml}
          </gin:ListaRps>
        </gin:RecepcionarLoteRpsEnvio>
      </soapenv:Body>
    </soapenv:Envelope>`;
  }

  private async parseGinfesRecepcaoResponse(xml: string) {
    // tenta parsear a resposta e extrair protocolo
    try {
      const parsed = await parseStringPromise(xml, { explicitArray: false, ignoreAttrs: false });
      // caminhos variam conforme provedor; tentamos com alguns caminhos prováveis
      const body = parsed['soap:Envelope']?.['soap:Body'] || parsed['soapenv:Envelope']?.['soapenv:Body'] || parsed['Envelope']?.['Body'];
      if (!body) return null;
      const resp = body['RecepcionarLoteRpsResponse'] || body['RecepcionarLoteRpsResposta'] || body['RecepcionarLoteRpsEnvioResponse'];
      if (!resp) return null;
      const protocolo = resp['protocolo'] || resp['protocoloRecepcao'] || resp['protocol'];
      return protocolo || null;
    } catch (e: any) {
      this.logger.debug('Erro parseando resposta Ginfes: ' + (e?.message || String(e)));
      return null;
    }
  }

  async sendRps(rpsXml: string) {
    const cfg = this.cfg.getConfig();
    // homologacao curto-circuito (simulado)
    if (cfg.environment === 'homologacao') {
      return { success: true, status: 'processing', protocol: 'REC' + Math.floor(Math.random() * 1000000) };
    }

    // provider-specific: GINFES (São Paulo)
    if ((cfg.provider || '').toUpperCase() === 'GINFES') {
      const endpoint = cfg.endpoint || cfg.ginfes?.url || cfg.url;
      if (!endpoint) return { success: false, status: 'error', message: 'Endpoint Ginfes não configurado' };
      const envelope = this.buildGinfesEnvelope(rpsXml);
      try {
        const res = await axios.post(endpoint, envelope, {
          headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
          timeout: cfg.timeout || 30000,
        });
        const protocolo = await this.parseGinfesRecepcaoResponse(res.data);
        // persistir recepcao
        if (this.nfseRepo) {
      const partial: DeepPartial<NfseEntity> = { xml: rpsXml, protocolo: protocolo || undefined, status: protocolo ? 'processing' : 'error', response: res.data };
        const ent = this.nfseRepo.create(partial);
          await this.nfseRepo.save(ent);
        }
        if (protocolo) return { success: true, status: 'processing', protocol: protocolo };
        return { success: false, status: 'error', message: 'Não foi possível extrair protocolo da resposta' };
      } catch (e: any) {
        this.logger.error('Erro enviando RPS para Ginfes: ' + (e?.message || e));
        if (this.nfseRepo) {
          const partial: DeepPartial<NfseEntity> = { xml: rpsXml, protocolo: undefined, status: 'error', response: String(e?.message || e) };
          const ent = this.nfseRepo.create(partial);
          await this.nfseRepo.save(ent);
        }
        return { success: false, status: 'error', message: e?.message || String(e) };
      }
    }

    // fallback genérico
    return { success: false, status: 'error', message: 'Envio via SOAP não implementado para este provedor' };
  }

  /**
   * Cria registro NFSe com invoiceId, salva xml e envia o RPS
   */
  async createRecordAndSend(invoiceId: number | string, rpsXml: string) {
    // criar registro inicial
    let record: NfseEntity | null = null;
    if (this.nfseRepo) {
      const partialInit: DeepPartial<NfseEntity> = { invoiceId: Number(invoiceId), xml: rpsXml, status: 'created' };
      const created = this.nfseRepo.create(partialInit);
      record = await this.nfseRepo.save(created);
    }

    const res = await this.sendRps(rpsXml);

    // atualizar registro com protocolo/response/status
    if (this.nfseRepo && record) {
      record.protocolo = res.protocol || null as any;
      record.status = res.success ? (res.status || 'processing') : 'error';
      record.response = JSON.stringify(res);
      await this.nfseRepo.save(record as any);
    }

    return { res, record };
  }

  async consult(protocolo: string) {
    const cfg = this.cfg.getConfig();
    if (cfg.environment === 'homologacao') {
      const nfseNumber = Math.floor(Math.random() * 99999).toString();
      // atualizar entidade existente pelo protocolo
      if (this.nfseRepo) {
        const rec = await this.nfseRepo.findOne({ where: { protocolo } as any } as any);
        if (rec) {
          rec.status = 'authorized';
          rec.nfseNumber = nfseNumber;
          await this.nfseRepo.save(rec as any);
        }
      }
      return { success: true, status: 'authorized', message: 'NFS-e autorizada', protocol: protocolo, nfseNumber };
    }
    // Implementação de consulta para Ginfes
    if ((cfg.provider || '').toUpperCase() === 'GINFES') {
      const endpoint = cfg.endpoint || cfg.ginfes?.url || cfg.url;
      if (!endpoint) return { success: false, status: 'error', message: 'Endpoint Ginfes não configurado' };
      // Envelope de consulta (simplificado) — adaptar conforme WSDL/versão
      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:gin="http://www.ginfes.com.br/">
        <soapenv:Header/>
        <soapenv:Body>
          <gin:ConsultarLoteRps>
            <gin:protocolo>` + protocolo + `</gin:protocolo>
          </gin:ConsultarLoteRps>
        </soapenv:Body>
      </soapenv:Envelope>`;
      try {
        const res = await axios.post(endpoint, envelope, {
          headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
          timeout: cfg.timeout || 30000,
        });
        // tentar extrair resultado simples
        const parsed = await parseStringPromise(res.data, { explicitArray: false, ignoreAttrs: false });
        // caminho genérico
        const body = parsed['soap:Envelope']?.['soap:Body'] || parsed['soapenv:Envelope']?.['soapenv:Body'] || parsed['Envelope']?.['Body'];
        const resp = body['ConsultarLoteRpsResponse'] || body['ConsultarLoteRpsResposta'] || body['ConsultarLoteRps'];
        if (resp) {
          // tentativa de extrair campos comuns
          const status = resp['status'] || resp['situacao'] || 'unknown';
          const nfseNumber = resp['numeroNfse'] || resp['numero'] || null;
          // atualizar entidade
          if (this.nfseRepo) {
            const rec = await this.nfseRepo.findOne({ where: { protocolo } as any } as any);
            if (rec) {
              rec.status = status;
              if (nfseNumber) rec.nfseNumber = nfseNumber as any;
              await this.nfseRepo.save(rec as any);
            }
          }
          return { success: true, status, message: 'Consulta realizada', protocol: protocolo, nfseNumber };
        }
        return { success: false, status: 'error', message: 'Resposta inesperada na consulta' };
      } catch (e: any) {
        this.logger.error('Erro consultando Ginfes: ' + (e?.message || e));
        return { success: false, status: 'error', message: e?.message || String(e) };
      }
    }

    return { success: false, status: 'error', message: 'Consulta não implementada para este provedor' };
  }
}
