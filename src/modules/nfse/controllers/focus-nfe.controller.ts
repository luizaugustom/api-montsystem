import { Body, Controller, Get, Param, Post, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { FocusNfeService, FocusNfePayload } from '../services/focus-nfe.service';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../../shared/guards/permissions.guard';
import { Permissions } from '../../../shared/decorators/permissions.decorator';
import { IntegrationsStorage } from '../../integrations/integrations-storage';

@Controller('focus-nfe')
@UseGuards(AuthGuard, PermissionsGuard)
export class FocusNfeController {
  constructor(
    private focus: FocusNfeService,
    private integrations: IntegrationsStorage,
  ) {}

  @Post('emit')
  @Permissions('nfse', 'edit')
  async emit(@Body() body: FocusNfePayload) {
    return this.focus.emitir(body);
  }

  @Get(':ref')
  @Permissions('nfse', 'view')
  async consult(@Param('ref') ref: string) {
    return this.focus.consultar(ref);
  }

  @Get()
  @Permissions('nfse', 'view')
  async list(@Query('monthlyChargeId') monthlyChargeId?: string, @Query('invoiceId') invoiceId?: string) {
    // invoiceId agora é UUID string (NfseEntity.invoiceId foi migrado para varchar).
    return this.focus.listAll({
      monthlyChargeId,
      invoiceId,
    });
  }

  @Get('id/:id')
  @Permissions('nfse', 'view')
  async findById(@Param('id') id: string) {
    const rec = await this.focus.findById(Number(id));
    if (!rec) throw new NotFoundException(`NFSe ${id} não encontrada`);
    return rec;
  }
}
