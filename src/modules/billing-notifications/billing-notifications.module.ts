import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingNotification } from './entities/billing-notification.entity';
import { BillingNotificationsRepository } from './billing-notifications.repository';
import { NfseEmailListener } from './listeners/nfse-email.listener';
import { EmailService } from '../../shared/services/email.service';
import { ResendService } from '../../shared/services/resend.service';
import { NFeModule } from '../nfe/nfe.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MonthlyCharge } from '../monthly-charges/entities/monthly-charge.entity';

@Module({
  imports: [
    // Registra as duas entidades para que o listener possa injetar o repo
    // do MonthlyCharge direto via @InjectRepository, evitando ciclo com
    // MonthlyChargesModule.
    TypeOrmModule.forFeature([BillingNotification, MonthlyCharge]),
    NFeModule, // provê NFeConfigService para o EmailService
    // Provê IntegrationsStorage (cache das configs persistedas em
    // Postgres) consumido pelo ResendService → injetado em EmailService.
    IntegrationsModule,
  ],
  providers: [
    BillingNotificationsRepository,
    NfseEmailListener,
    EmailService,
    ResendService,
  ],
  exports: [BillingNotificationsRepository, TypeOrmModule],
})
export class BillingNotificationsModule {}
