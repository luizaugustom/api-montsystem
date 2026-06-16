import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationsStorage } from './integrations-storage';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsStorage, IntegrationsService],
  exports: [IntegrationsStorage, IntegrationsService],
})
export class IntegrationsModule {}
