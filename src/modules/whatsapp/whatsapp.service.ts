import { Injectable, Logger } from '@nestjs/common';
import { WhatsappRepository } from './whatsapp.repository';
import { EvolutionService } from '../../shared/services/evolution.service';
import { WhatsappMessage, WhatsappMessageStatus } from './entities/whatsapp-message.entity';
import { renderTemplate, WhatsAppTemplateKey } from '../../shared/templates/whatsapp/whatsapp-templates';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private repo: WhatsappRepository,
    private evolution: EvolutionService,
  ) {}

  /**
   * Renderiza e envia um template, salvando log.
   */
  async sendTemplate(opts: {
    phone: string;
    templateKey: WhatsAppTemplateKey;
    variables: Record<string, string | number | null | undefined>;
    customerId?: string;
    monthlyChargeId?: string;
    mediaUrl?: string;
    mediaCaption?: string;
  }): Promise<WhatsappMessage> {
    const text = renderTemplate(opts.templateKey, opts.variables);
    return this.sendText({
      phone: opts.phone,
      text,
      templateKey: opts.templateKey,
      customerId: opts.customerId,
      monthlyChargeId: opts.monthlyChargeId,
      mediaUrl: opts.mediaUrl,
      mediaCaption: opts.mediaCaption,
    });
  }

  /**
   * Envia texto (com ou sem mídia). Sempre grava log.
   *
   * Quando `markAsBulk=true`, também aceita `dispatchId`/`scheduledAt`/`contactId`
   * para diferenciar mensagens originadas de campanha. Listeners atuais não
   * passam esses campos, mantendo o comportamento 1-a-1 intocado.
   */
  async sendText(opts: {
    phone: string;
    text: string;
    templateKey?: string;
    customerId?: string;
    contactId?: string;
    monthlyChargeId?: string;
    mediaUrl?: string;
    mediaCaption?: string;
    isBulk?: boolean;
    dispatchId?: string;
    scheduledAt?: Date;
  }): Promise<WhatsappMessage> {
    const normalized = EvolutionService.normalizePhone(opts.phone);
    if (!normalized) {
      const msg = this.repo.create({
        phone: opts.phone,
        text: opts.text,
        templateKey: opts.templateKey,
        customerId: opts.customerId,
        monthlyChargeId: opts.monthlyChargeId,
        status: WhatsappMessageStatus.FAILED,
        errorMessage: 'Telefone inválido',
        direction: 'OUTBOUND' as any,
      });
      return msg;
    }

    // Cria registro QUEUED primeiro
    const queued = await this.repo.create({
      phone: normalized,
      text: opts.text,
      templateKey: opts.templateKey,
      customerId: opts.customerId,
      contactId: opts.contactId,
      monthlyChargeId: opts.monthlyChargeId,
      status: WhatsappMessageStatus.QUEUED,
      direction: 'OUTBOUND' as any,
      payload: opts.mediaUrl ? { mediaUrl: opts.mediaUrl, mediaCaption: opts.mediaCaption } : null,
      isBulk: !!opts.isBulk,
      dispatchId: opts.isBulk ? opts.dispatchId : null,
      scheduledAt: opts.isBulk ? opts.scheduledAt : null,
    });

    if (!this.evolution.isConfigured()) {
      queued.status = WhatsappMessageStatus.FAILED;
      queued.errorMessage = 'Evolution API não configurada';
      return this.repo.save(queued);
    }

    try {
      let res;
      if (opts.mediaUrl) {
        res = await this.evolution.sendMedia({
          number: normalized,
          mediatype: 'document',
          media: opts.mediaUrl,
          fileName: 'boleto.pdf',
          caption: opts.mediaCaption || opts.text.slice(0, 200),
        });
      } else {
        res = await this.evolution.sendText({ number: normalized, text: opts.text });
      }

      if (res.error) {
        queued.status = WhatsappMessageStatus.FAILED;
        queued.errorMessage = res.error;
        this.logger.warn(`WhatsApp falhou para ${normalized}: ${res.error}`);
      } else {
        queued.status = WhatsappMessageStatus.SENT;
        queued.evolutionMessageId = (res as any).key?.id || (res as any).id || null;
      }
      return this.repo.save(queued);
    } catch (e: any) {
      queued.status = WhatsappMessageStatus.FAILED;
      queued.errorMessage = e?.message || 'Erro';
      return this.repo.save(queued);
    }
  }

  async getInstanceStatus() {
    return this.evolution.getInstanceState();
  }

  /**
   * Busca o QR code de pareamento para exibir na UI.
   * Se a instância já está `open`, retorna `{ connected: true }` sem base64.
   */
  async getInstanceQR() {
    return this.evolution.connectInstance();
  }

  /**
   * Desconecta a instância WhatsApp. Após logout, a próxima chamada a
   * `getInstanceQR()` retorna um novo QR para re-parear.
   */
  async logoutInstance() {
    return this.evolution.logoutInstance();
  }

  findAll(opts: Parameters<WhatsappRepository['findAll']>[0] = {}) {
    return this.repo.findAll(opts);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  count(opts: Parameters<WhatsappRepository['count']>[0] = {}) {
    return this.repo.count(opts);
  }

  /**
   * Atualiza status a partir de um webhook do Evolution. Procura por evolutionMessageId.
   */
  async updateFromWebhook(evolutionMessageId: string, status: WhatsappMessageStatus, errorMessage?: string): Promise<WhatsappMessage | null> {
    const list = await this.repo.findAll({ limit: 200 });
    const target = list.find((m) => m.evolutionMessageId === evolutionMessageId);
    if (!target) return null;
    target.status = status;
    if (errorMessage) target.errorMessage = errorMessage;
    return this.repo.save(target);
  }
}
