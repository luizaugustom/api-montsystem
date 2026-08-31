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
import { ExpensesModule } from './modules/expenses/expenses.module';
import { SpacesModule } from './shared/storage/spaces.module';
import { NotificationListener } from './shared/notification/notification.listener';
import { ContactsModule } from './modules/contacts/contacts.module';
import { WhatsappTemplatesModule } from './modules/whatsapp-templates/whatsapp-templates.module';
import { HealthModule } from './modules/health/health.module';

const useSsl =
  process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'db',
      port: Number(process.env.DATABASE_PORT || 5432),
      username: process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'montsystem',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      synchronize: process.env.TYPEORM_SYNC === 'true',
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    }),
    HealthModule,
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
    WhatsappTemplatesModule,
    TicketsModule,
    ExpensesModule,
    ContactsModule,
    SpacesModule,
  ],
  providers: [NotificationListener],
})
export class AppModule {}
