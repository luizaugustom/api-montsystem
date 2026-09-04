import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';
import { AuthModule } from '../auth/auth.module';
import { NFeModule } from '../nfe/nfe.module';

@Module({
  imports: [TypeOrmModule.forFeature([Company]), AuthModule, NFeModule],
  controllers: [CompanyController],
  providers: [CompanyService],
  exports: [CompanyService],
})
export class CompanyModule {}
