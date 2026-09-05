import { Module, forwardRef } from '@nestjs/common';
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
import { CustomersModule } from '../customers/customers.module';
import { CompanyModule } from '../company/company.module';
import { EmailService } from '../../shared/services/email.service';
import { ResendService } from '../../shared/services/resend.service';
import { InvoiceEmailListener } from './listeners/invoice-email.listener';
import { SalePaidInvoiceListener } from './listeners/sale-paid-invoice.listener';
import { MonthlyCharge } from '../monthly-charges/entities/monthly-charge.entity';
import { MonthlyChargesModule } from '../monthly-charges/monthly-charges.module';

@Module({
  imports: [
    // Registra a entidade Invoice + MonthlyCharge para que InvoicesService
    // consiga ler mensalidades diretamente via Repository (evita ciclo de módulos).
    TypeOrmModule.forFeature([Invoice, MonthlyCharge]),
    // forwardRef em ambos os lados do ciclo (InvoicesModule ↔ SalesModule e
    // InvoicesModule ↔ MonthlyChargesModule). Sem forwardRef aqui, NestJS
    // encontra `undefined` em runtime ao resolver o grafo de módulos.
    forwardRef(() => SalesModule),
    NFeModule,
    NfseModule,
    AuthModule,
    IntegrationsModule,
    CustomersModule,
    CompanyModule,
    forwardRef(() => MonthlyChargesModule),
  ],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoicesRepository,
    ResendService,
    EmailService,
    InvoiceEmailListener,
    SalePaidInvoiceListener,
  ],
  exports: [InvoicesService, InvoicesRepository, ResendService, EmailService],
})
export class InvoicesModule {}
