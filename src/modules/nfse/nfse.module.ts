import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NfseEntity } from './entities/nfse.entity';
import { FocusNfeController } from './controllers/focus-nfe.controller';
import { FocusNfeService } from './services/focus-nfe.service';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([NfseEntity]), IntegrationsModule, AuthModule],
  providers: [FocusNfeService],
  controllers: [FocusNfeController],
  exports: [FocusNfeService, TypeOrmModule],
})
export class NfseModule {}
