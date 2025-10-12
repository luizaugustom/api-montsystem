import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { Invoice } from './entities/invoice.entity';
import { SalesModule } from '../sales/sales.module';
import { NFeModule } from '../nfe/nfe.module';
import { AuthModule } from '../auth/auth.module';
import { EmailService } from '../../shared/services/email.service';
import { InvoiceEmailListener } from './listeners/invoice-email.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    SalesModule, // Importar para ter acesso ao SalesRepository
    NFeModule, // Importar para integração com SEFAZ
  // NFSe para serviços (módulo novo)
  // Import dynamic to avoid circular at runtime, but add to imports
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('../nfse/nfse.module').NfseModule,
    AuthModule, // Necessário para disponibilizar AuthService/AuthGuard
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService, 
    InvoicesRepository,
    EmailService,
    InvoiceEmailListener,
  ],
  exports: [InvoicesService, InvoicesRepository],
})
export class InvoicesModule {}