import { Injectable } from '@nestjs/common';
import { create } from 'xmlbuilder2';
import { NfseConfigService } from './nfse-config.service';

@Injectable()
export class NfseXmlService {
  constructor(private cfg: NfseConfigService) {}

  generateRpsXml(rpsData: any) {
    // rpsData: { numero, serie, dataEmissao, prestador, tomador, itens, valores }
    const doc = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Rps')
        .ele('Numero').txt(rpsData.numero).up()
        .ele('Serie').txt(rpsData.serie).up()
        .ele('DataEmissao').txt(new Date(rpsData.dataEmissao).toISOString()).up()
        .ele('Prestador')
          .ele('Cnpj').txt(rpsData.prestador.cnpj).up()
          .ele('InscricaoMunicipal').txt(rpsData.prestador.im).up()
        .up()
        .ele('Tomador')
          .ele('CpfCnpj').txt(rpsData.tomador.cpfCnpj).up()
          .ele('RazaoSocial').txt(rpsData.tomador.nome).up()
        .up();

    const itens = doc.ele('Itens');
    (rpsData.itens || []).forEach((it: any, idx: number) => {
      itens.ele('Item')
        .ele('ItemNumero').txt((idx+1).toString()).up()
        .ele('Discriminacao').txt(it.descricao).up()
        .ele('Valor').txt(it.valor.toFixed(2)).up()
      .up();
    });

    const xml = doc.end({ prettyPrint: true });
    return xml;
  }
}
