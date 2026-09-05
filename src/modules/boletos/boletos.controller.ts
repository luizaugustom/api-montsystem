import { Body, BadRequestException, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express';
import * as fs from 'fs';
import { BoletosService } from './boletos.service';
import { BoletoStatus } from './entities/boleto.entity';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { IntegrationsStorage } from '../integrations/integrations-storage';

@Controller('boletos')
export class BoletosController {
  constructor(
    private service: BoletosService,
    private integrations: IntegrationsStorage,
  ) {}

  @Get()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'view')
  async list(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('monthlyChargeId') monthlyChargeId?: string,
    @Query('saleId') saleId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status: status as BoletoStatus,
      customerId,
      monthlyChargeId,
      saleId,
      startDate,
      endDate,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/pdf')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'view')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.service.getPdf(id);
    if (!pdf) {
      return res.status(404).json({ message: 'PDF do boleto não disponível' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    fs.createReadStream(pdf.path).pipe(res);
  }

  /**
   * Emite boleto vinculado a exatamente uma origem (venda XOR mensalidade).
   * O fluxo avulso (`customerId` + valor) foi removido — toda cobrança precisa
   * estar ligada a uma venda (`POST /sales/:id/issue-boleto`) ou a uma
   * mensalidade (`POST /monthly-charges/:id/issue-boleto`).
   */
  @Post()
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'edit')
  async issue(
    @Body()
    body: { saleId?: string; monthlyChargeId?: string; nossoNumero?: string },
  ) {
    const hasSale = !!body.saleId;
    const hasCharge = !!body.monthlyChargeId;
    if (hasSale === hasCharge) {
      throw new BadRequestException(
        'Forneça exatamente um: saleId (venda) OU monthlyChargeId (mensalidade).',
      );
    }
    return this.service.issue(body);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'edit')
  async cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post('reconcile')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('boletos', 'edit')
  async reconcile() {
    return this.service.reconcilePending();
  }

  /**
   * Webhook público. Validação por token de assinatura (UNIMAKE_WEBHOOK_SECRET).
   * Sem @UseGuards e sem @Permissions: deve continuar acessível sem JWT.
   */
  @Post('webhook/unimake')
  async webhook(@Body() body: any, @Req() req: Request) {
    const cfg = this.integrations.getOne('unimake');
    const provided = req.headers['x-webhook-token'] || body?.webhookSecret;
    if (cfg.webhookSecret && provided !== cfg.webhookSecret) {
      return { ok: false, message: 'Token inválido' };
    }
    // Unimake geralmente envia: { nossoNumero, situacao, valorPago, dataPagamento }
    const nossoNumero = body?.nossoNumero || body?.data?.nossoNumero;
    const situacao = (body?.situacao || body?.data?.situacao || '').toLowerCase();
    if (!nossoNumero) return { ok: false, message: 'nossoNumero ausente' };
    if (situacao.includes('pago') || situacao.includes('liquidado') || situacao.includes('baixa')) {
      await this.service.markAsPaid({
        nossoNumero,
        paidAmountCents: body.valorPago ? Math.round(body.valorPago * 100) : undefined,
        paidAt: body.dataPagamento,
      });
    } else if (situacao.includes('vencido') || situacao.includes('atrasado')) {
      // marca como overdue; sem mudança de paid
      const b = await this.service.findOne as any;
    }
    return { ok: true };
  }
}
