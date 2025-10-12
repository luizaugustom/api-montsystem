import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sale as any]), AuthModule],
  controllers: [SalesController],
  providers: [SalesRepository, SalesService],
  exports: [SalesRepository, SalesService],
})
export class SalesModule {}
