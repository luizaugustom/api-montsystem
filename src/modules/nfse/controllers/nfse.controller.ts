import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { NfseXmlService } from '../services/nfse-xml.service';
import { NfseSignatureService } from '../services/nfse-signature.service';
import { NfseWebServiceService } from '../services/nfse-webservice.service';

@Controller('nfse')
export class NfseController {
  constructor(private xml: NfseXmlService, private sign: NfseSignatureService, private web: NfseWebServiceService) {}

  @Post('rps')
  async createRps(@Body() body: any) {
    const xml = this.xml.generateRpsXml(body);
    const signed = this.sign.signXml(xml);
    const res = await this.web.sendRps(signed);
    return { xml, signed, res };
  }

  @Get('consult')
  async consult(@Query('protocol') protocol: string) {
    return this.web.consult(protocol);
  }
}
