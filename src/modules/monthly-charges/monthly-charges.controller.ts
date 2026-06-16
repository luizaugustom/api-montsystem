import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MonthlyChargesService } from './monthly-charges.service';
import { MonthlyChargeStatus } from './entities/monthly-charge.entity';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';

@Controller('monthly-charges')
@UseGuards(AuthGuard, PermissionsGuard)
export class MonthlyChargesController {
  constructor(private service: MonthlyChargesService) {}

  @Get()
  @Permissions('mensalidades', 'view')
  async list(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('competencia') competencia?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status: status as MonthlyChargeStatus,
      customerId,
      competencia,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get('overdue')
  @Permissions('mensalidades', 'view')
  async overdue() {
    return this.service.findOverdue();
  }

  @Get(':id')
  @Permissions('mensalidades', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('generate')
  @Permissions('mensalidades', 'edit')
  async generate(@Body() body: { competencia?: string; customerIds?: string[] }) {
    return this.service.generate({
      competencia: body.competencia,
      onlyCustomerIds: body.customerIds,
    });
  }

  @Post(':id/mark-paid')
  @Permissions('mensalidades', 'edit')
  async markPaid(@Param('id') id: string) {
    return this.service.markAsPaid(id);
  }

  @Post(':id/cancel')
  @Permissions('mensalidades', 'edit')
  async cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/issue-boleto')
  @Permissions('mensalidades', 'edit')
  async issueBoleto(@Param('id') id: string) {
    return this.service.issueBoletoForCharge(id);
  }

  @Post(':id/issue-nfse')
  @Permissions('mensalidades', 'edit')
  async issueNfse(@Param('id') id: string) {
    return this.service.issueNfseForCharge(id);
  }
}
