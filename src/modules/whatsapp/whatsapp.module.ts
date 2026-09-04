import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { WhatsappRepository } from './whatsapp.repository';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { ZapiService } from '../../shared/services/zapi.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';
import { AntiBanService } from './anti-ban.service';
import { BulkDispatchService } from './bulk-dispatch.service';
import { BulkDispatchCron } from './bulk-dispatch.cron';
import { ContactsModule } from '../contacts/contacts.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WhatsappMessage]),
    IntegrationsModule,
    AuthModule,
    ContactsModule,
    CustomersModule,
  ],
  providers: [
    WhatsappRepository,
    WhatsappService,
    ZapiService,
    AntiBanService,
    BulkDispatchService,
    BulkDispatchCron,
  ],
  controllers: [WhatsappController],
  exports: [WhatsappService, ZapiService, TypeOrmModule],
})
export class WhatsappModule {}
