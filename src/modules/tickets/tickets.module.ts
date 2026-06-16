import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsRepository } from './tickets.repository';
import { TicketsService } from './tickets.service';
import { AuthModule } from '../auth/auth.module';
import { CustomersModule } from '../customers/customers.module';
import { SpacesModule } from '../../shared/storage/spaces.module';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), AuthModule, CustomersModule, SpacesModule],
  controllers: [TicketsController],
  providers: [TicketsRepository, TicketsService],
  exports: [TicketsService, TicketsRepository],
})
export class TicketsModule {}
