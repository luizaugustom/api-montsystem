import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Boleto } from './entities/boleto.entity';
import { BoletosRepository } from './boletos.repository';
import { BoletosService } from './boletos.service';
import { BoletosController } from './boletos.controller';
import { BoletoListener } from './listeners/boleto.listener';
import { UnimakeService } from '../../shared/services/unimake.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { EmailService } from '../../shared/services/email.service';
import { ResendService } from '../../shared/services/resend.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MonthlyCharge } from '../monthly-charges/entities/monthly-charge.entity';
import { MonthlyChargesModule } from '../monthly-charges/monthly-charges.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Boleto, MonthlyCharge]),
    IntegrationsModule,
    AuthModule,
    CustomersModule,
    WhatsappModule,
    forwardRef(() => MonthlyChargesModule),
  ],
  providers: [BoletosRepository, BoletosService, UnimakeService, ResendService, EmailService, BoletoListener],
  controllers: [BoletosController],
  exports: [BoletosService, UnimakeService, TypeOrmModule],
})
export class BoletosModule {}
