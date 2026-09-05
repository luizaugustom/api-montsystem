import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { Sale } from './entities/sale.entity';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { BoletosModule } from '../boletos/boletos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale as any]),
    AuthModule,
    // forwardRef: SalesService injeta InvoicesService (issue-invoice manual);
    // InvoicesService não injeta SalesService diretamente, mas o ciclo evita-se
    // com forwardRef caso algum listener futuro precise.
    forwardRef(() => InvoicesModule),
    // forwardRef: SalesController injeta BoletosService (POST /sales/:id/issue-boleto).
    forwardRef(() => BoletosModule),
  ],
  controllers: [SalesController],
  providers: [SalesRepository, SalesService],
  exports: [SalesRepository, SalesService],
})
export class SalesModule {}
