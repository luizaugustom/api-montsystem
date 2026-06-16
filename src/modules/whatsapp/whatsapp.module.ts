import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappMessage } from './entities/whatsapp-message.entity';
import { WhatsappRepository } from './whatsapp.repository';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { EvolutionService } from '../../shared/services/evolution.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappMessage]), IntegrationsModule, AuthModule],
  providers: [WhatsappRepository, WhatsappService, EvolutionService],
  controllers: [WhatsappController],
  exports: [WhatsappService, EvolutionService, TypeOrmModule],
})
export class WhatsappModule {}
