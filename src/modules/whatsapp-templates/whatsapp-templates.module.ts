import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappTemplate } from './entities/whatsapp-template.entity';
import { WhatsappTemplatesRepository } from './whatsapp-templates.repository';
import { WhatsappTemplatesService } from './whatsapp-templates.service';
import { WhatsappTemplatesController } from './whatsapp-templates.controller';
import { WhatsappTemplatesSeeder } from './whatsapp-templates.seeder';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappTemplate]), AuthModule],
  controllers: [WhatsappTemplatesController],
  providers: [WhatsappTemplatesRepository, WhatsappTemplatesService, WhatsappTemplatesSeeder],
  exports: [WhatsappTemplatesService, WhatsappTemplatesRepository],
})
export class WhatsappTemplatesModule {}