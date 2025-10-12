import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { CompanyModule } from './modules/company/company.module';
import { NfseModule } from './modules/nfse/nfse.module';
import { NotificationListener } from './shared/notification/notification.listener';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
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
    CustomersModule,
    SalesModule,
    InvoicesModule,
    CompanyModule,
    NfseModule,
  ],
  providers: [NotificationListener],
})
export class AppModule {}
