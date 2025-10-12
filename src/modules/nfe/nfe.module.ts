import { Module } from '@nestjs/common';
import { NFeConfigService } from './services/nfe-config.service';
import { NFeXmlService } from './services/nfe-xml.service';
import { NFeSignatureService } from './services/nfe-signature.service';
import { NFeWebServiceService } from './services/nfe-webservice.service';
import { DanfeService } from './services/danfe.service';

@Module({
  providers: [
    NFeConfigService,
    NFeXmlService,
    NFeSignatureService,
    NFeWebServiceService,
    DanfeService,
  ],
  exports: [
    NFeConfigService,
    NFeXmlService,
    NFeSignatureService,
    NFeWebServiceService,
    DanfeService,
  ],
})
export class NFeModule {}