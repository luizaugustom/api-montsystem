import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { NFeData, NFeItem } from '../interfaces/nfe.interface';
import { NFeConfigService } from './nfe-config.service';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NFeXmlService {
  constructor(private readonly configService: NFeConfigService) {}

  generateNFeXml(data: NFeData): string {
    const config = this.configService.getConfig();
    const isHomologacao = this.configService.isHomologacao();
    
    // Gerar chave de acesso
    const accessKey = this.generateAccessKey(data);
    
    // Criar XML base
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' });

    const infNFe = root.ele('infNFe', { 
      Id: `NFe${accessKey}`,
      versao: '4.00'
    });

    // IDE - Identificação da NFe
    this.addIdeSection(infNFe, data, config, isHomologacao);
    
    // EMIT - Emitente
    this.addEmitSection(infNFe, config);
    
    // DEST - Destinatário
    this.addDestSection(infNFe, data.destinatario);
    
    // DET - Detalhamento dos produtos/serviços
    data.items.forEach((item, index) => {
      this.addDetSection(infNFe, item, index + 1);
    });
    
    // TOTAL - Totais da NFe
    this.addTotalSection(infNFe, data.total);
    
    // TRANSP - Transporte
    this.addTranspSection(infNFe, data.transporte);
    
    // INFADIC - Informações adicionais
    if (data.infAdic || isHomologacao) {
      this.addInfAdicSection(infNFe, data.infAdic, isHomologacao);
    }

    return root.end({ prettyPrint: true });
  }

  private generateAccessKey(data: NFeData): string {
    const config = this.configService.getConfig();
    
    // Código UF (2 dígitos)
    const ufCode = this.getUfCode(config.company.address.state);
    
    // Ano e mês (4 dígitos)
    const anoMes = dayjs(data.dhEmi).format('YYMM');
    
    // CNPJ (14 dígitos)
    const cnpj = config.company.cnpj.replace(/\D/g, '');
    
    // Modelo (2 dígitos) - 55 para NFe
    const modelo = '55';
    
    // Série (3 dígitos)
    const serie = data.serie.padStart(3, '0');
    
    // Número (9 dígitos)
    const numero = data.numero.padStart(9, '0');
    
    // Tipo de emissão (1 dígito) - 1 = Normal
    const tipoEmissao = '1';
    
    // Código numérico (8 dígitos) - sequencial
    const codigoNumerico = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
    
    // Montar chave sem DV
    const chaveSemDv = ufCode + anoMes + cnpj + modelo + serie + numero + tipoEmissao + codigoNumerico;
    
    // Calcular dígito verificador
    const dv = this.calculateMod11(chaveSemDv);
    
    return chaveSemDv + dv;
  }

  private getUfCode(uf: string): string {
    const ufCodes: Record<string, string> = {
      'AC': '12', 'AL': '17', 'AP': '16', 'AM': '23', 'BA': '29',
      'CE': '23', 'DF': '53', 'ES': '32', 'GO': '52', 'MA': '21',
      'MT': '51', 'MS': '50', 'MG': '31', 'PA': '15', 'PB': '25',
      'PR': '41', 'PE': '26', 'PI': '22', 'RJ': '33', 'RN': '24',
      'RS': '43', 'RO': '11', 'RR': '14', 'SC': '42', 'SP': '35',
      'SE': '28', 'TO': '27'
    };
    return ufCodes[uf] || '35';
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

  private addIdeSection(infNFe: any, data: NFeData, config: any, isHomologacao: boolean): void {
    const ide = infNFe.ele('ide');
    
    ide.ele('cUF', this.getUfCode(config.company.address.state));
    ide.ele('cNF', Math.floor(Math.random() * 99999999).toString().padStart(8, '0'));
    ide.ele('natOp', 'Prestacao de servicos');
    ide.ele('mod', '55'); // 55 = NFe
    ide.ele('serie', data.serie);
    ide.ele('nNF', data.numero);
    ide.ele('dhEmi', dayjs(data.dhEmi).format('YYYY-MM-DDTHH:mm:ssZ'));
    if (data.dhSaiEnt) {
      ide.ele('dhSaiEnt', dayjs(data.dhSaiEnt).format('YYYY-MM-DDTHH:mm:ssZ'));
    }
    ide.ele('tpNF', '1'); // 0=Entrada, 1=Saída
    ide.ele('idDest', '1'); // 1=Operação interna, 2=Interestadual, 3=Exterior
    ide.ele('cMunFG', config.company.address.cityCode);
    ide.ele('tpImp', '1'); // 1=DANFE normal
    ide.ele('tpEmis', '1'); // 1=Emissão normal
    ide.ele('cDV', '0'); // Será calculado
    ide.ele('tpAmb', isHomologacao ? '2' : '1'); // 1=Produção, 2=Homologação
    ide.ele('finNFe', '1'); // 1=NFe normal
    ide.ele('indFinal', '1'); // 1=Consumidor final
    ide.ele('indPres', '0'); // 0=Não se aplica
    ide.ele('procEmi', '0'); // 0=Emissão própria
    ide.ele('verProc', '1.0.0');
  }

  private addEmitSection(infNFe: any, config: any): void {
    const emit = infNFe.ele('emit');
    
    emit.ele('CNPJ', config.company.cnpj.replace(/\D/g, ''));
    emit.ele('xNome', config.company.name);
    if (config.company.fantasy) {
      emit.ele('xFant', config.company.fantasy);
    }
    
    const enderEmit = emit.ele('enderEmit');
    enderEmit.ele('xLgr', config.company.address.street);
    enderEmit.ele('nro', config.company.address.number);
    enderEmit.ele('xBairro', config.company.address.neighborhood);
    enderEmit.ele('cMun', config.company.address.cityCode);
    enderEmit.ele('xMun', config.company.address.city);
    enderEmit.ele('UF', config.company.address.state);
    enderEmit.ele('CEP', config.company.address.cep.replace(/\D/g, ''));
    enderEmit.ele('cPais', '1058');
    enderEmit.ele('xPais', 'Brasil');
    if (config.company.contact.phone) {
      enderEmit.ele('fone', config.company.contact.phone.replace(/\D/g, ''));
    }
    
    emit.ele('IE', config.company.ie.replace(/\D/g, ''));
    emit.ele('CRT', config.company.crt.toString());
  }

  private addDestSection(infNFe: any, destinatario: NFeData['destinatario']): void {
    const dest = infNFe.ele('dest');
    
    const cpfCnpj = destinatario.cpfCnpj.replace(/\D/g, '');
    if (cpfCnpj.length === 11) {
      dest.ele('CPF', cpfCnpj);
    } else {
      dest.ele('CNPJ', cpfCnpj);
    }
    
    dest.ele('xNome', destinatario.nome);
    
    const enderDest = dest.ele('enderDest');
    enderDest.ele('xLgr', destinatario.endereco.logradouro);
    enderDest.ele('nro', destinatario.endereco.numero);
    if (destinatario.endereco.complemento) {
      enderDest.ele('xCpl', destinatario.endereco.complemento);
    }
    enderDest.ele('xBairro', destinatario.endereco.bairro);
    enderDest.ele('cMun', destinatario.endereco.codigoMunicipio);
    enderDest.ele('xMun', destinatario.endereco.cidade);
    enderDest.ele('UF', destinatario.endereco.uf);
    enderDest.ele('CEP', destinatario.endereco.cep.replace(/\D/g, ''));
    enderDest.ele('cPais', '1058');
    enderDest.ele('xPais', 'Brasil');
    
    dest.ele('indIEDest', '9'); // 9=Não contribuinte
    
    if (destinatario.email) {
      dest.ele('email', destinatario.email);
    }
  }

  private addDetSection(infNFe: any, item: NFeItem, nItem: number): void {
    const det = infNFe.ele('det', { nItem: nItem.toString() });
    
    const prod = det.ele('prod');
    prod.ele('cProd', item.codigo);
    prod.ele('cEAN', 'SEM GTIN');
    prod.ele('xProd', item.descricao);
    prod.ele('NCM', item.ncm);
    prod.ele('CFOP', item.cfop);
    prod.ele('uCom', item.unidade);
    prod.ele('qCom', item.quantidade.toFixed(4));
    prod.ele('vUnCom', item.valorUnitario.toFixed(2));
    prod.ele('vProd', item.valorTotal.toFixed(2));
    prod.ele('cEANTrib', 'SEM GTIN');
    prod.ele('uTrib', item.unidade);
    prod.ele('qTrib', item.quantidade.toFixed(4));
    prod.ele('vUnTrib', item.valorUnitario.toFixed(2));
    prod.ele('indTot', '1'); // 0=Não compõe total, 1=Compõe total
    
    // Impostos
    const imposto = det.ele('imposto');
    
    // ICMS
    const icms = imposto.ele('ICMS');
    if (item.icms) {
      const icms00 = icms.ele('ICMS00');
      icms00.ele('orig', item.icms.origem);
      icms00.ele('CST', item.icms.cst);
      icms00.ele('modBC', '3');
      icms00.ele('vBC', item.valorTotal.toFixed(2));
      icms00.ele('pICMS', (item.icms.aliquota || 0).toFixed(2));
      icms00.ele('vICMS', (item.icms.valor || 0).toFixed(2));
    } else {
      const icmsSN101 = icms.ele('ICMSSN101');
      icmsSN101.ele('orig', '0');
      icmsSN101.ele('CSOSN', '101');
      icmsSN101.ele('pCredSN', '0.00');
      icmsSN101.ele('vCredICMSSN', '0.00');
    }
    
    // PIS
    const pis = imposto.ele('PIS');
    const pisNT = pis.ele('PISNT');
    pisNT.ele('CST', '07'); // 07 = Operação isenta da contribuição
    
    // COFINS
    const cofins = imposto.ele('COFINS');
    const cofinsNT = cofins.ele('COFINSNT');
    cofinsNT.ele('CST', '07'); // 07 = Operação isenta da contribuição
  }

  private addTotalSection(infNFe: any, total: NFeData['total']): void {
    const totalElement = infNFe.ele('total');
    
    const icmsTot = totalElement.ele('ICMSTot');
    icmsTot.ele('vBC', (total.valorIcms || 0).toFixed(2));
    icmsTot.ele('vICMS', (total.valorIcms || 0).toFixed(2));
    icmsTot.ele('vICMSDeson', '0.00');
    icmsTot.ele('vFCP', '0.00');
    icmsTot.ele('vBCST', '0.00');
    icmsTot.ele('vST', '0.00');
    icmsTot.ele('vFCPST', '0.00');
    icmsTot.ele('vFCPSTRet', '0.00');
    icmsTot.ele('vProd', total.valorProdutos.toFixed(2));
    icmsTot.ele('vFrete', (total.valorFrete || 0).toFixed(2));
    icmsTot.ele('vSeg', (total.valorSeguro || 0).toFixed(2));
    icmsTot.ele('vDesc', (total.valorDesconto || 0).toFixed(2));
    icmsTot.ele('vII', '0.00');
    icmsTot.ele('vIPI', (total.valorIpi || 0).toFixed(2));
    icmsTot.ele('vIPIDevol', '0.00');
    icmsTot.ele('vPIS', (total.valorPis || 0).toFixed(2));
    icmsTot.ele('vCOFINS', (total.valorCofins || 0).toFixed(2));
    icmsTot.ele('vOutro', '0.00');
    icmsTot.ele('vNF', total.valorNota.toFixed(2));
  }

  private addTranspSection(infNFe: any, transporte?: NFeData['transporte']): void {
    const transp = infNFe.ele('transp');
    transp.ele('modFrete', transporte?.modalidade || '9'); // 9=Sem ocorrência de transporte
    
    if (transporte?.transportador) {
      const transporta = transp.ele('transporta');
      const cpfCnpj = transporte.transportador.cpfCnpj.replace(/\D/g, '');
      
      if (cpfCnpj.length === 11) {
        transporta.ele('CPF', cpfCnpj);
      } else {
        transporta.ele('CNPJ', cpfCnpj);
      }
      
      transporta.ele('xNome', transporte.transportador.nome);
      if (transporte.transportador.ie) {
        transporta.ele('IE', transporte.transportador.ie);
      }
      if (transporte.transportador.endereco) {
        transporta.ele('xEnder', transporte.transportador.endereco);
      }
    }
  }

  private addInfAdicSection(infNFe: any, infAdic?: string, isHomologacao = false): void {
    const infAdicElement = infNFe.ele('infAdic');
    
    let texto = infAdic || '';
    
    if (isHomologacao) {
      texto = 'NFe emitida em ambiente de homologacao - SEM VALOR FISCAL' + (texto ? ' - ' + texto : '');
    }
    
    if (texto) {
      infAdicElement.ele('infCpl', texto);
    }
  }
}