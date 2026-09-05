import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsStorage } from './integrations-storage';
import { IntegrationSettings } from './entities/integration-settings.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrationSettings]), AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsStorage, IntegrationsService],
  exports: [IntegrationsStorage, IntegrationsService],
})
export class IntegrationsModule {}
