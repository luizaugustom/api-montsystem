import { Injectable } from '@nestjs/common';
import { NFeConfigService } from './nfe-config.service';
import { NFeXmlService } from './nfe-xml.service';
import { NFeSignatureService } from './nfe-signature.service';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { XMLParser } from 'fast-xml-parser';

interface SefazResponse {
  success: boolean;
  status: string;
  message: string;
  protocol?: string;
  accessKey?: string;
  xml?: string;
  errors?: string[];
  warnings?: string[];
}

interface LoteNFe {
  id: string;
  nfes: Array<{
    xml: string;
    accessKey: string;
  }>;
}

@Injectable()
export class NFeWebServiceService {
  constructor(
    private readonly configService: NFeConfigService,
    private readonly xmlService: NFeXmlService,
    private readonly signatureService: NFeSignatureService,
  ) {}

  async sendNFe(xmlContent: string): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      const webServiceUrls = this.configService.getWebServiceUrls();
      
      // Assinar XML
      const signedXml = await this.signatureService.signXml(xmlContent);
      
      // Criar lote
      const loteId = this.generateLoteId();
      const lote = this.createLote(loteId, [signedXml]);
      
      // Enviar para autorização
      const authResponse = await this.sendAuthorization(lote, webServiceUrls.autorizacao);
      
      if (!authResponse.success) {
        return authResponse;
      }
      
      // Consultar retorno
      const recibo = authResponse.protocol;
      if (recibo) {
        const retornoResponse = await this.consultRetorno(recibo, webServiceUrls.retAutorizacao);
        return retornoResponse;
      }
      
      return authResponse;
      
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: `Erro na comunicação com SEFAZ: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  async consultNFe(accessKey: string): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      const webServiceUrls = this.configService.getWebServiceUrls();
      
      const consultaXml = this.createConsultaXml(accessKey);
      
      // Para ambiente de homologação, simular resposta
      if (config.environment === 'homologacao') {
        return this.simulateConsultaResponse(accessKey);
      }
      
  const soapEnvelope = this.createSoapEnvelopeConsultaProtocolo(consultaXml);
  const response = await this.sendSoapRequest(webServiceUrls.consultaProtocolo, soapEnvelope);
  return this.parseConsultaResponse(response);
      
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: `Erro ao consultar NFe: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  async cancelNFe(accessKey: string, justificativa: string, protocolNumber: string): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      const webServiceUrls = this.configService.getWebServiceUrls();
      
      if (justificativa.length < 15) {
        throw new Error('Justificativa deve ter pelo menos 15 caracteres');
      }
      
      const eventoXml = this.createCancelamentoXml(accessKey, justificativa, protocolNumber);
      const signedEventoXml = await this.signatureService.signXml(eventoXml);
      
      // Para ambiente de homologação, simular resposta
      if (config.environment === 'homologacao') {
        return this.simulateCancelamentoResponse(accessKey);
      }
      
  const soapEnvelope = this.createSoapEnvelopeRecepcaoEvento(signedEventoXml);
  const response = await this.sendSoapRequest(webServiceUrls.recepcaoEvento, soapEnvelope);
  return this.parseCancelamentoResponse(response);
      
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: `Erro ao cancelar NFe: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  async checkServiceStatus(): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      const webServiceUrls = this.configService.getWebServiceUrls();
      
      const statusXml = this.createStatusServiceXml();
      
      // Para ambiente de homologação, simular resposta
      if (config.environment === 'homologacao') {
        return {
          success: true,
          status: 'online',
          message: 'Serviço em operação (Homologação)'
        };
      }
      
  const soapEnvelope = this.createSoapEnvelopeStatusServico(statusXml);
  const response = await this.sendSoapRequest(webServiceUrls.statusServico, soapEnvelope);
  return this.parseStatusResponse(response);
      
    } catch (error: any) {
      return {
        success: false,
        status: 'offline',
        message: `Erro ao verificar status: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  private generateLoteId(): string {
    return Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
  }

  private createLote(loteId: string, xmls: string[]): string {
    const config = this.configService.getConfig();
    
    const loteXml = `<?xml version="1.0" encoding="UTF-8"?>
<enviNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>${loteId}</idLote>
  <indSinc>1</indSinc>
  ${xmls.join('\n')}
</enviNFe>`;
    
    return loteXml;
  }

  private async sendAuthorization(loteXml: string, url: string): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      
      // Para ambiente de homologação, simular resposta
      if (config.environment === 'homologacao') {
        const recibo = Math.floor(Math.random() * 999999999).toString();
        
        return {
          success: true,
          status: 'processing',
          message: 'Lote recebido com sucesso',
          protocol: recibo
        };
      }
      
  // Envio real via SOAP
  const soapEnvelope = this.createSoapEnvelopeAutorizacao(loteXml);
      const response = await this.sendSoapRequest(url, soapEnvelope);
      
      return this.parseAuthorizationResponse(response);
      
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: `Erro no envio: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  private async consultRetorno(recibo: string, url: string): Promise<SefazResponse> {
    try {
      const config = this.configService.getConfig();
      
      // Para ambiente de homologação, simular resposta autorizada
      if (config.environment === 'homologacao') {
        const accessKey = this.generateAccessKey();
        const protocolNumber = `135${dayjs().format('YYMMDDHHmmss')}`;
        
        return {
          success: true,
          status: 'authorized',
          message: 'Autorizado o uso da NF-e',
          protocol: protocolNumber,
          accessKey: accessKey
        };
      }
      
      const consultaXml = `<?xml version="1.0" encoding="UTF-8"?>
<consReciNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>${config.environment === 'producao' ? '1' : '2'}</tpAmb>
  <nRec>${recibo}</nRec>
</consReciNFe>`;
      
      // TODO: Implementar consulta real via SOAP
  const soapEnvelope = this.createSoapEnvelopeRetAutorizacao(consultaXml);
      const response = await this.sendSoapRequest(url, soapEnvelope);
      
      return this.parseRetornoResponse(response);
      
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        message: `Erro na consulta: ${error.message}`,
        errors: [error.message]
      };
    }
  }

  private createConsultaXml(accessKey: string): string {
    const config = this.configService.getConfig();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<consSitNFe versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>${config.environment === 'producao' ? '1' : '2'}</tpAmb>
  <xServ>CONSULTAR</xServ>
  <chNFe>${accessKey}</chNFe>
</consSitNFe>`;
  }

  private createCancelamentoXml(accessKey: string, justificativa: string, protocolNumber: string): string {
    const config = this.configService.getConfig();
    const nSeqEvento = '1';
    const dhEvento = dayjs().format('YYYY-MM-DDTHH:mm:ssZ');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<envEvento versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <idLote>1</idLote>
  <evento versao="1.00">
    <infEvento Id="ID110111${accessKey}01">
      <cOrgao>35</cOrgao>
      <tpAmb>${config.environment === 'producao' ? '1' : '2'}</tpAmb>
      <CNPJ>${config.company.cnpj.replace(/\D/g, '')}</CNPJ>
      <chNFe>${accessKey}</chNFe>
      <dhEvento>${dhEvento}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>${nSeqEvento}</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${protocolNumber}</nProt>
        <xJust>${justificativa}</xJust>
      </detEvento>
    </infEvento>
  </evento>
</envEvento>`;
  }

  private createStatusServiceXml(): string {
    const config = this.configService.getConfig();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <tpAmb>${config.environment === 'producao' ? '1' : '2'}</tpAmb>
  <cUF>35</cUF>
  <xServ>STATUS</xServ>
</consStatServ>`;
  }

  private createSoapEnvelope(method: string, xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope 
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope" 
  xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
  <soap:Header />
  <soap:Body>
    <nfe:${method}>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:${method}>
  </soap:Body>
</soap:Envelope>`;
  }
  
  private createSoapEnvelopeAutorizacao(xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
  <soap12:Header />
  <soap12:Body>
    <nfe:nfeAutorizacaoLote>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:nfeAutorizacaoLote>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private createSoapEnvelopeRetAutorizacao(xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
  <soap12:Header />
  <soap12:Body>
    <nfe:nfeRetAutorizacaoLote>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:nfeRetAutorizacaoLote>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private createSoapEnvelopeConsultaProtocolo(xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">
  <soap12:Header />
  <soap12:Body>
    <nfe:nfeConsultaNF>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:nfeConsultaNF>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private createSoapEnvelopeRecepcaoEvento(xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/RecepcaoEvento4">
  <soap12:Header />
  <soap12:Body>
    <nfe:nfeRecepcaoEvento>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:nfeRecepcaoEvento>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private createSoapEnvelopeStatusServico(xmlContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">
  <soap12:Header />
  <soap12:Body>
    <nfe:nfeStatusServicoNF>
      <nfe:nfeDadosMsg>${xmlContent}</nfe:nfeDadosMsg>
    </nfe:nfeStatusServicoNF>
  </soap12:Body>
</soap12:Envelope>`;
  }

  private async sendSoapRequest(url: string, soapXml: string): Promise<string> {
    try {
      const cfg = this.configService.getConfig();
      const agent = (cfg.certificate?.path && cfg.certificate?.password)
        ? new https.Agent({
            pfx: await fs.readFile(cfg.certificate.path),
            passphrase: cfg.certificate.password,
            rejectUnauthorized: false
          })
        : undefined;

      const response = await axios.post(url, soapXml, {
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'SOAPAction': ''
        },
        timeout: this.configService.getConfig().timeout,
        httpsAgent: agent
      });
      
      return response.data;
      
    } catch (error: any) {
      throw new Error(`Erro na requisição SOAP: ${error.message}`);
    }
  }

  private parseAuthorizationResponse(soapResponse: string): SefazResponse {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    try {
      const json: any = parser.parse(soapResponse);
      const body = json['soap:Envelope']?.['soap:Body'] || json['soap12:Envelope']?.['soap12:Body'] || json.Envelope?.Body;
      const ret = body && (body.nfeAutorizacaoLoteResponse || body['nfeAutorizacaoLoteResponse']);
      const msg = ret?.nfeResultMsg || ret?.['nfeResultMsg'];
      const retEnv = msg?.retEnviNFe || msg?.['retEnviNFe'];
      const cStat = retEnv?.cStat || retEnv?.['cStat'];
      const xMotivo = retEnv?.xMotivo || retEnv?.['xMotivo'];
      const infRec = retEnv?.infRec || retEnv?.['infRec'];
      const nRec = infRec?.nRec || infRec?.['nRec'];
      if (cStat === '103' && nRec) {
        return { success: true, status: 'processing', message: xMotivo || 'Lote recebido com sucesso', protocol: nRec };
      }
      return { success: false, status: 'error', message: xMotivo || 'Falha no envio' };
    } catch (e: any) {
      return { success: false, status: 'error', message: 'Falha ao parsear resposta de autorização', errors: [e.message] };
    }
  }

  private parseRetornoResponse(soapResponse: string): SefazResponse {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    try {
      const json: any = parser.parse(soapResponse);
      const body = json['soap:Envelope']?.['soap:Body'] || json['soap12:Envelope']?.['soap12:Body'] || json.Envelope?.Body;
      const ret = body && (body.nfeRetAutorizacaoLoteResponse || body['nfeRetAutorizacaoLoteResponse']);
      const msg = ret?.nfeResultMsg || ret?.['nfeResultMsg'];
      const retCons = msg?.retConsReciNFe || msg?.['retConsReciNFe'];
      const cStatGeral = retCons?.cStat;
      const xMotivoGeral = retCons?.xMotivo;
      // protNFe pode ser lista ou único
      const prot = Array.isArray(retCons?.protNFe) ? retCons.protNFe[0] : retCons?.protNFe;
      const infProt = prot?.infProt;
      const cStat = infProt?.cStat;
      const xMotivo = infProt?.xMotivo || xMotivoGeral;
      const chNFe = infProt?.chNFe;
      const nProt = infProt?.nProt;
      if (cStat === '100') {
        return { success: true, status: 'authorized', message: xMotivo || 'Autorizado o uso da NF-e', protocol: nProt, accessKey: chNFe };
      }
      return { success: false, status: 'rejected', message: xMotivo || 'Rejeição no retorno', errors: [cStat || cStatGeral] };
    } catch (e: any) {
      return { success: false, status: 'error', message: 'Falha ao parsear retorno de autorização', errors: [e.message] };
    }
  }

  private parseConsultaResponse(soapResponse: string): SefazResponse {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    try {
      const json: any = parser.parse(soapResponse);
      const body = json['soap:Envelope']?.['soap:Body'] || json['soap12:Envelope']?.['soap12:Body'] || json.Envelope?.Body;
      const ret = body && (body.nfeConsultaNFResponse || body['nfeConsultaNFResponse']);
      const msg = ret?.nfeResultMsg || ret?.['nfeResultMsg'];
      const cons = msg?.retConsSitNFe || msg?.['retConsSitNFe'];
      const cStat = cons?.cStat;
      const xMotivo = cons?.xMotivo;
      const prot = cons?.protNFe;
      const infProt = prot?.infProt;
      const chNFe = infProt?.chNFe;
      const nProt = infProt?.nProt;
      const cStatProt = infProt?.cStat;
      if (cStatProt === '100' || cStat === '100') {
        return { success: true, status: 'authorized', message: xMotivo || 'Autorizado o uso da NF-e', protocol: nProt, accessKey: chNFe };
      }
      return { success: false, status: 'rejected', message: xMotivo || 'Consulta retornou rejeição', errors: [cStat || cStatProt] };
    } catch (e: any) {
      return { success: false, status: 'error', message: 'Falha ao parsear consulta', errors: [e.message] };
    }
  }

  private parseCancelamentoResponse(soapResponse: string): SefazResponse {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    try {
      const json: any = parser.parse(soapResponse);
      const body = json['soap:Envelope']?.['soap:Body'] || json['soap12:Envelope']?.['soap12:Body'] || json.Envelope?.Body;
      const ret = body && (body.nfeRecepcaoEventoResponse || body['nfeRecepcaoEventoResponse']);
      const msg = ret?.nfeResultMsg || ret?.['nfeResultMsg'];
      const retEnv = msg?.retEnvEvento || msg?.['retEnvEvento'];
      const retEvento = Array.isArray(retEnv?.retEvento) ? retEnv.retEvento[0] : retEnv?.retEvento;
      const infEvento = retEvento?.infEvento;
      const cStat = infEvento?.cStat;
      const xMotivo = infEvento?.xMotivo;
      const nProt = infEvento?.nProt;
      if (cStat === '135' || cStat === '101') {
        return { success: true, status: 'cancelled', message: xMotivo || 'Cancelamento autorizado', protocol: nProt };
      }
      return { success: false, status: 'error', message: xMotivo || 'Falha no cancelamento', errors: [cStat] };
    } catch (e: any) {
      return { success: false, status: 'error', message: 'Falha ao parsear cancelamento', errors: [e.message] };
    }
  }

  private parseStatusResponse(soapResponse: string): SefazResponse {
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    try {
      const json: any = parser.parse(soapResponse);
      const body = json['soap:Envelope']?.['soap:Body'] || json['soap12:Envelope']?.['soap12:Body'] || json.Envelope?.Body;
      const ret = body && (body.nfeStatusServicoNFResponse || body['nfeStatusServicoNFResponse']);
      const msg = ret?.nfeResultMsg || ret?.['nfeResultMsg'];
      const stat = msg?.retConsStatServ || msg?.['retConsStatServ'];
      const cStat = stat?.cStat;
      const xMotivo = stat?.xMotivo;
      const online = cStat === '107' || cStat === 107;
      return { success: !!online, status: online ? 'online' : 'offline', message: xMotivo || (online ? 'Serviço em operação' : 'Serviço indisponível') };
    } catch (e: any) {
      return { success: false, status: 'offline', message: 'Falha ao parsear status', errors: [e.message] };
    }
  }

  private simulateConsultaResponse(accessKey: string): SefazResponse {
    return {
      success: true,
      status: 'authorized',
      message: 'NFe autorizada (Homologação)',
      accessKey: accessKey,
      protocol: '135' + dayjs().format('YYMMDDHHmmss')
    };
  }

  private simulateCancelamentoResponse(accessKey: string): SefazResponse {
    return {
      success: true,
      status: 'cancelled',
      message: 'Cancelamento autorizado (Homologação)',
      accessKey: accessKey,
      protocol: '135' + dayjs().format('YYMMDDHHmmss')
    };
  }

  private generateAccessKey(): string {
    // Gerar chave de acesso simulada para homologação
    const uf = '35'; // SP
    const anoMes = dayjs().format('YYMM');
    const cnpj = '12345678000195';
    const modelo = '55';
    const serie = '001';
    const numero = Math.floor(Math.random() * 999999999).toString().padStart(9, '0');
    const tipoEmissao = '1';
    const codigo = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    
    const chave = uf + anoMes + cnpj + modelo + serie + numero + tipoEmissao + codigo;
    const dv = this.calculateMod11(chave);
    
    return chave + dv;
  }

  private calculateMod11(sequence: string): string {
    const weights = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < sequence.length; i++) {
      sum += parseInt(sequence[i]) * weights[i];
    }
    
    const remainder = sum % 11;
    return remainder < 2 ? '0' : (11 - remainder).toString();
  }
}