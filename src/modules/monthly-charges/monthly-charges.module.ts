import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyCharge } from './entities/monthly-charge.entity';
import { MonthlyChargesRepository } from './monthly-charges.repository';
import { MonthlyChargesService } from './monthly-charges.service';
import { MonthlyChargesController } from './monthly-charges.controller';
import { MonthlyChargeListener } from './listeners/monthly-charge.listener';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { BoletosModule } from '../boletos/boletos.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ResendService } from '../../shared/services/resend.service';
import { EmailService } from '../../shared/services/email.service';
import { NFeModule } from '../nfe/nfe.module';
import { NfseModule } from '../nfse/nfse.module';
import { BillingNotificationsModule } from '../billing-notifications/billing-notifications.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyCharge]),
    IntegrationsModule,
    AuthModule,
    CustomersModule,
    // forwardRef: SalesModule também depende transitivamente de InvoicesModule
    // (através do SalesController -> SalesService -> InvoicesService). Sem
    // forwardRef aqui, o scanner do Nest resolve SalesModule como `undefined`
    // enquanto InvoicesModule ainda está sendo instanciado.
    forwardRef(() => SalesModule), // provê SalesRepository para o listener maybeEmitSalePaid
    forwardRef(() => BoletosModule),
    WhatsappModule,
    NFeModule,
    NfseModule,
    BillingNotificationsModule,
    // forwardRef: MonthlyChargesService injeta InvoicesService para criar
    // invoice a partir de mensalidade (refator do fluxo direto FocusNfeService).
    // InvoicesService injeta MonthlyChargesRepository. Ciclo resolvido.
    forwardRef(() => InvoicesModule),
  ],
  providers: [MonthlyChargesRepository, MonthlyChargesService, MonthlyChargeListener, ResendService, EmailService],
  controllers: [MonthlyChargesController],
  exports: [MonthlyChargesService, MonthlyChargesRepository, TypeOrmModule],
})
export class MonthlyChargesModule {}
