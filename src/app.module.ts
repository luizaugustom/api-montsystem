import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CompanyModule } from './modules/company/company.module';
import { NfseModule } from './modules/nfse/nfse.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { BoletosModule } from './modules/boletos/boletos.module';
import { MonthlyChargesModule } from './modules/monthly-charges/monthly-charges.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UsersModule } from './modules/users/users.module';
import { SpacesModule } from './shared/storage/spaces.module';
import { NotificationListener } from './shared/notification/notification.listener';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'db',
      port: Number(process.env.DATABASE_PORT || 5432),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'montsystem',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    AuthModule,
    UsersModule,
    CustomersModule,
    SalesModule,
    InvoicesModule,
    CompanyModule,
    NfseModule,
    IntegrationsModule,
    BoletosModule,
    MonthlyChargesModule,
    WhatsappModule,
    TicketsModule,
    SpacesModule,
  ],
  providers: [NotificationListener],
})
export class AppModule {}
