import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoicesRepository } from './invoices.repository';
import { Invoice } from './entities/invoice.entity';
import { SalesModule } from '../sales/sales.module';
import { NFeModule } from '../nfe/nfe.module';
import { NfseModule } from '../nfse/nfse.module';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { EmailService } from '../../shared/services/email.service';
import { ResendService } from '../../shared/services/resend.service';
import { InvoiceEmailListener } from './listeners/invoice-email.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice]),
    SalesModule,
    NFeModule,
    NfseModule,
    AuthModule,
    IntegrationsModule,
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesRepository,
    ResendService,
    EmailService,
    InvoiceEmailListener,
  ],
  exports: [InvoicesService, InvoicesRepository, ResendService, EmailService],
})
export class InvoicesModule {}
