import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfseConfigService, NfseXmlService, NfseSignatureService, NfseWebServiceService } from './services';
import { NfseController } from './controllers/nfse.controller';
import { CompanyModule } from '../company/company.module';
import { NfseEntity } from './entities/nfse.entity';

@Module({
  imports: [CompanyModule, TypeOrmModule.forFeature([NfseEntity])],
  providers: [NfseConfigService, NfseXmlService, NfseSignatureService, NfseWebServiceService],
  controllers: [NfseController],
  exports: [NfseConfigService, NfseXmlService, NfseSignatureService, NfseWebServiceService]
})
export class NfseModule {}
