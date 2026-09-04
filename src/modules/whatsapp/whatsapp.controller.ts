import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMessageStatus } from './entities/whatsapp-message.entity';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { IntegrationsStorage } from '../integrations/integrations-storage';
import { BulkDispatchService } from './bulk-dispatch.service';
import { BULK_DEFAULTS } from './anti-ban.constants';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private service: WhatsappService,
    private integrations: IntegrationsStorage,
    private bulk: BulkDispatchService,
  ) {}

  @Get('messages')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async list(
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('monthlyChargeId') monthlyChargeId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      status: status as WhatsappMessageStatus,
      customerId,
      monthlyChargeId,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get('messages/:id')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Get('instance-status')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async status() {
    return this.service.getInstanceStatus();
  }

  /**
   * Retorna o QR code de pareamento (base64) ou `{ connected: true }` se a
   * instância já está conectada. A UI usa este endpoint para exibir o QR
   * enquanto a instância não está `open`.
   */
  @Get('instance/qr')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async qr() {
    return this.service.getInstanceQR();
  }

  /**
   * Desconecta a instância WhatsApp. Após isso, o próximo `instance/qr`
   * retorna um QR novo.
   */
  @Post('instance/logout')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'edit')
  async logout() {
    return this.service.logoutInstance();
  }

  @Post('send')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'edit')
  async send(@Body() body: { phone: string; text: string; templateKey?: string; mediaUrl?: string; mediaCaption?: string }) {
    return this.service.sendText(body);
  }

  /**
   * Cria uma campanha em massa. Enfileira (não envia) mensagens para cada
   * destinatário. O cron drenador (BulkDispatchCron) processa respeitando
   * todas as camadas anti-ban.
   */
  @Post('bulk/dispatch')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'edit')
  async bulkDispatch(
    @Body()
    body: {
      customerIds?: string[];
      contactIds?: string[];
      text: string;
      templateId?: string;
    },
  ) {
    return this.bulk.createBulk(body);
  }

  /** Retorna contadores agregados por dispatchId para acompanhamento na UI. */
  @Get('bulk/status')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async bulkStatus(@Query('dispatchId') dispatchId: string) {
    return this.bulk.getDispatchStatus(dispatchId);
  }

  /** Expõe os limites anti-ban atuais para a UI exibir no card de configuração. */
  @Get('bulk/limits')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'view')
  async bulkLimits() {
    return BULK_DEFAULTS;
  }

  /**
   * Webhook público da Z-API (status de entrega).
   * Sem @UseGuards e sem @Permissions: deve continuar acessível sem JWT.
   *
   * Payload típico:
   *   { type: 'MessageStatusCallback', messageId, status: 'SENT|DELIVERED|READ|FAILED', phone, error?: { message } }
   *
   * Autenticação: Z-API envia `Client-Token` em todas as chamadas de webhook.
   * Aceita também `webhookSecret` no body como fallback para contas antigas.
   */
  @Post('webhook/zapi')
  async webhook(@Body() body: any, @Req() req: any) {
    const cfg = this.integrations.getOne('zapi');
    const providedHeader =
      req.headers['client-token'] || req.headers['x-client-token'];
    const provided = providedHeader || body?.webhookSecret;
    const okAuth =
      (cfg.clientToken && providedHeader === cfg.clientToken) ||
      (cfg.webhookSecret && provided === cfg.webhookSecret) ||
      (!cfg.clientToken && !cfg.webhookSecret);
    if (!okAuth) {
      return { ok: false, message: 'Token inválido' };
    }

    const messageId = body?.messageId || body?.data?.messageId;
    const status = this.mapStatus(body?.status || body?.data?.status);
    if (!messageId || !status) {
      return { ok: true, ignored: true };
    }

    const errorMessage =
      body?.status === 'FAILED' ? body?.error?.message || 'FAILED' : undefined;
    await this.service.updateFromWebhook(messageId, status, errorMessage);
    return { ok: true };
  }

  private mapStatus(s: string | number): WhatsappMessageStatus | null {
    const v = String(s || '').toUpperCase();
    if (v === 'SENT') return WhatsappMessageStatus.SENT;
    if (v === 'DELIVERED') return WhatsappMessageStatus.DELIVERED;
    if (v === 'READ') return WhatsappMessageStatus.READ;
    if (v === 'FAILED' || v === 'ERROR') return WhatsappMessageStatus.FAILED;
    return null;
  }
}
