import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappMessageStatus } from './entities/whatsapp-message.entity';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';
import { IntegrationsStorage } from '../integrations/integrations-storage';

@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private service: WhatsappService,
    private integrations: IntegrationsStorage,
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

  @Post('send')
  @UseGuards(AuthGuard, PermissionsGuard)
  @Permissions('whatsapp', 'edit')
  async send(@Body() body: { phone: string; text: string; templateKey?: string; mediaUrl?: string; mediaCaption?: string }) {
    return this.service.sendText(body);
  }

  /**
   * Webhook público. Validação por token de assinatura.
   * Sem @UseGuards e sem @Permissions: deve continuar acessível sem JWT.
   */
  @Post('webhook/evolution')
  async webhook(@Body() body: any, @Req() req: any) {
    // Valida token de assinatura
    const cfg = this.integrations.getOne('evolution');
    const provided = req.headers['x-evolution-token'] || body?.webhookSecret;
    if (cfg.webhookSecret && provided !== cfg.webhookSecret) {
      return { ok: false, message: 'Token inválido' };
    }
    // Processa evento messages.update
    const event = body?.event || body?.type;
    if (event === 'messages.update' || event === 'send.message') {
      const updates = Array.isArray(body.data) ? body.data : [body.data].filter(Boolean);
      for (const upd of updates) {
        const status = this.mapStatus(upd?.status || upd?.update?.status);
        const messageId = upd?.key?.id || upd?.id;
        if (messageId && status) {
          await this.service.updateFromWebhook(messageId, status, upd?.error || upd?.update?.error);
        }
      }
    }
    return { ok: true };
  }

  private mapStatus(s: string | number): WhatsappMessageStatus | null {
    const str = String(s || '').toLowerCase();
    if (str.includes('delivered') || str === '2') return WhatsappMessageStatus.DELIVERED;
    if (str.includes('read') || str === '3' || str === '4') return WhatsappMessageStatus.READ;
    if (str.includes('failed') || str.includes('error')) return WhatsappMessageStatus.FAILED;
    if (str.includes('sent') || str === '1') return WhatsappMessageStatus.SENT;
    return null;
  }
}
