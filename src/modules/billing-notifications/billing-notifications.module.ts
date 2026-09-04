import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingNotification } from './entities/billing-notification.entity';
import { BillingNotificationsRepository } from './billing-notifications.repository';
import { NfseEmailListener } from './listeners/nfse-email.listener';
import { EmailService } from '../../shared/services/email.service';
import { ResendService } from '../../shared/services/resend.service';
import { NFeModule } from '../nfe/nfe.module';
import { MonthlyCharge } from '../monthly-charges/entities/monthly-charge.entity';

@Module({
  imports: [
    // Registra as duas entidades para que o listener possa injetar o repo
    // do MonthlyCharge direto via @InjectRepository, evitando ciclo com
    // MonthlyChargesModule.
    TypeOrmModule.forFeature([BillingNotification, MonthlyCharge]),
    NFeModule, // provê NFeConfigService para o EmailService
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
