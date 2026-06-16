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

@Module({
  imports: [
    TypeOrmModule.forFeature([MonthlyCharge]),
    IntegrationsModule,
    AuthModule,
    CustomersModule,
    forwardRef(() => BoletosModule),
    WhatsappModule,
  ],
  providers: [MonthlyChargesRepository, MonthlyChargesService, MonthlyChargeListener, ResendService, EmailService],
  controllers: [MonthlyChargesController],
  exports: [MonthlyChargesService, MonthlyChargesRepository, TypeOrmModule],
})
export class MonthlyChargesModule {}
