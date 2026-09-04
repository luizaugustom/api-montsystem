import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WhatsappRepository } from './whatsapp.repository';
import { WhatsappMessage, WhatsappMessageStatus } from './entities/whatsapp-message.entity';
import { ZapiService } from '../../shared/services/zapi.service';
import { AntiBanService } from './anti-ban.service';
import { ContactsService } from '../contacts/contacts.service';
import { CustomersService } from '../customers/customers.service';
import { BULK_TICK_LIMIT, BULK_MAX_ATTEMPTS } from './anti-ban.constants';

/**
 * Coordena o disparo em massa (bulk dispatch) de WhatsApp.
 *
 * createBulk()        — recebe lista de customerIds/contactIds + texto; enfileira
 *                       linhas em whatsapp_messages (status=QUEUED) sem chamar Z-API.
 * dispatchPending()   — drena filas respeitando limites anti-ban. Chamado pelo cron.
 * retryFailed()       — reprocessa falhas antigas. Chamado pelo cron.
 * getDispatchStatus() — retorna contadores agregados por dispatchId.
 */
@Injectable()
export class BulkDispatchService {
  private readonly logger = new Logger(BulkDispatchService.name);

  constructor(
    private repo: WhatsappRepository,
    private zapi: ZapiService,
    private antiBan: AntiBanService,
    private contacts: ContactsService,
    private customers: CustomersService,
  ) {}

  /**
   * Cria uma campanha. Valida destinatários, normaliza telefones,
   * opcionalmente consulta Z-API para descartar números sem WhatsApp
   * (Z-API não expõe esse endpoint; a validação retorna skipped=true),
   * e enfileira uma linha por destinatário.
   */
  async createBulk(input: {
    customerIds?: string[];
    contactIds?: string[];
    text: string;
    templateId?: string;
  }): Promise<{ dispatchId: string; count: number; invalidNumbers?: string[] }> {
    const customerIds = input.customerIds || [];
    const contactIds = input.contactIds || [];

    if (customerIds.length === 0 && contactIds.length === 0) {
      throw new BadRequestException('Selecione ao menos um destinatário');
    }
    if (!input.text?.trim()) {
      throw new BadRequestException('Texto da mensagem é obrigatório');
    }
    if (input.text.length > 4096) {
      throw new BadRequestException('Mensagem excede 4096 caracteres do WhatsApp');
    }

    // Coleta telefones
    const phones: { phone: string; customerId?: string; contactId?: string }[] = [];
    if (customerIds.length) {
      const map = await this.customers.findByIds(customerIds);
      for (const c of map.values()) {
        if (c?.phone) phones.push({ phone: c.phone, customerId: c.id });
      }
    }
    if (contactIds.length) {
      const contacts = await this.contacts.findByIds(contactIds);
      for (const c of contacts) {
        if (c?.phone && c.active !== false) phones.push({ phone: c.phone, contactId: c.id });
      }
    }

    if (phones.length === 0) {
      throw new BadRequestException('Nenhum destinatário com telefone válido');
    }

    // Camada 1 — validação prévia de números (se configurado)
    const uniquePhones = Array.from(new Set(phones.map((p) => p.phone)));
    const validation = await this.antiBan.validateNumbers(uniquePhones);
    const invalidSet = new Set(validation.invalid);
    const eligible = phones.filter((p) => !invalidSet.has(p.phone));

    if (eligible.length === 0) {
      throw new BadRequestException(
        `Nenhum destinatário tem WhatsApp ativo${validation.invalid.length ? ` (${validation.invalid.length} inválidos)` : ''}`,
      );
    }

    // Camada 6 — jitter entre destinatários
    const dispatchId = randomUUID();
    const now = new Date();
    const entities: WhatsappMessage[] = eligible.map((p) => ({
      id: undefined as any,
      customerId: p.customerId,
      contactId: p.contactId,
      direction: 'OUTBOUND' as any,
      phone: p.phone,
      text: input.text,
      templateKey: input.templateId ? `user:${input.templateId}` : undefined,
      status: WhatsappMessageStatus.QUEUED,
      payload: null,
      isBulk: true,
      dispatchId,
      scheduledAt: this.antiBan.jitterScheduledAt(now),
      attempts: 0,
      createdAt: now,
    } as WhatsappMessage));

    await this.repo.saveMany(entities);

    return {
      dispatchId,
      count: entities.length,
      invalidNumbers: validation.skipped ? undefined : validation.invalid,
    };
  }

  /**
   * Processa até BULK_TICK_LIMIT mensagens pendentes por execução.
   * Respeita todas as camadas anti-ban.
   */
  async dispatchPending(): Promise<{ processed: number; sent: number; failed: number; skipped: boolean }> {
    // Camada 2 — janela de horário comercial
    if (!this.antiBan.isWithinBusinessHours()) {
      return { processed: 0, sent: 0, failed: 0, skipped: true };
    }

    // Camadas 4 e 5 — rate limit por hora/dia
    const limitCheck = await this.antiBan.canSendNow();
    if (!limitCheck.allowed) {
      this.logger.log(`Pausando dispatch: limite ${limitCheck.reason} atingido`);
      return { processed: 0, sent: 0, failed: 0, skipped: true };
    }

    const pending = await this.repo.findPendingScheduled(BULK_TICK_LIMIT);
    if (pending.length === 0) return { processed: 0, sent: 0, failed: 0, skipped: false };

    let sent = 0;
    let failed = 0;

    for (const msg of pending) {
      // Re-checar rate limit entre envios
      const recheck = await this.antiBan.canSendNow();
      if (!recheck.allowed) {
        this.logger.log(`Pausando no meio do lote: limite ${recheck.reason}`);
        break;
      }

      try {
        const res = await this.zapi.sendText({ phone: msg.phone, message: msg.text || '' });
        if (res.error) {
          msg.status = WhatsappMessageStatus.FAILED;
          msg.errorMessage = res.error;
          failed++;
        } else {
          msg.status = WhatsappMessageStatus.SENT;
          msg.providerMessageId = (res as any).messageId || (res as any).id || null;
          sent++;
        }
      } catch (e: any) {
        msg.status = WhatsappMessageStatus.FAILED;
        msg.errorMessage = e?.message || 'Erro';
        failed++;
      }
      await this.repo.save(msg);

      // Camada 3 — delay aleatório entre mensagens (não no último)
      if (msg !== pending[pending.length - 1]) {
        await this.antiBan.randomDelay();
      }
    }

    return { processed: pending.length, sent, failed, skipped: false };
  }

  /**
   * Reprocessa mensagens com falha que ainda estão abaixo do limite de tentativas.
   */
  async retryFailed(): Promise<{ retried: number; sent: number; failed: number }> {
    const olderThan = new Date(Date.now() - 5 * 60 * 1000); // 5 min após a falha
    const failed = await this.repo.findFailedEligibleForRetry(BULK_TICK_LIMIT, olderThan);
    let sent = 0;
    let failed_count = 0;
    for (const msg of failed) {
      if (msg.attempts >= BULK_MAX_ATTEMPTS) continue;
      if (!this.antiBan.isWithinBusinessHours()) break;
      const recheck = await this.antiBan.canSendNow();
      if (!recheck.allowed) break;

      try {
        const res = await this.zapi.sendText({ phone: msg.phone, message: msg.text || '' });
        if (res.error) {
          msg.status = WhatsappMessageStatus.FAILED;
          msg.errorMessage = res.error;
          msg.attempts += 1;
          failed_count++;
        } else {
          msg.status = WhatsappMessageStatus.SENT;
          msg.providerMessageId = (res as any).messageId || (res as any).id || null;
          msg.attempts += 1;
          msg.errorMessage = undefined;
          sent++;
        }
      } catch (e: any) {
        msg.status = WhatsappMessageStatus.FAILED;
        msg.errorMessage = e?.message || 'Erro';
        msg.attempts += 1;
        failed_count++;
      }
      await this.repo.save(msg);
      await this.antiBan.randomDelay();
    }
    return { retried: failed.length, sent, failed: failed_count };
  }

  /** Status agregado de uma campanha para acompanhamento no frontend. */
  async getDispatchStatus(dispatchId: string) {
    const rows = await this.repo.countByDispatch(dispatchId);
    const counts: Record<string, number> = {
      QUEUED: 0,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      FAILED: 0,
    };
    let total = 0;
    for (const r of rows) {
      const n = Number(r.count);
      counts[r.status] = n;
      total += n;
    }
    return { dispatchId, total, ...counts };
  }
}