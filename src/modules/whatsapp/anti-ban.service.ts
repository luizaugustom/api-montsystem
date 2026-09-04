import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ZapiService } from '../../shared/services/zapi.service';
import { WhatsappMessage, WhatsappMessageStatus } from './entities/whatsapp-message.entity';
import {
  BULK_DELAY_MIN_MS,
  BULK_DELAY_MAX_MS,
  BULK_HOURLY_LIMIT,
  BULK_DAILY_LIMIT,
  BULK_BUSINESS_HOURS_START,
  BULK_BUSINESS_HOURS_END,
  BULK_JITTER_MAX_MS,
  BULK_VALIDATE_NUMBERS,
} from './anti-ban.constants';

/**
 * Camada anti-ban para disparo em massa.
 *
 * Camadas:
 *  1) validateNumbers — consulta Z-API para descartar números sem WhatsApp
 *    (Z-API não expõe esse endpoint; retorna skipped=true silenciosamente)
 *  2) isWithinBusinessHours — limita envios à janela configurada
 *  3) randomDelay — pausa aleatória entre envios (não fixa)
 *  4) canSendNow (hourly) — pausa se já passou do limite por hora
 *  5) canSendNow (daily) — pausa se já passou do limite diário
 *  6) jitterScheduledAt — randomiza scheduledAt entre destinatários
 *  7) Avisos tratados na UI
 *  8) Janela de 24h do WhatsApp (informativo na UI)
 */
@Injectable()
export class AntiBanService {
  private readonly logger = new Logger(AntiBanService.name);

  constructor(
    @InjectRepository(WhatsappMessage)
    private repo: Repository<WhatsappMessage>,
    private zapi: ZapiService,
  ) {}

  /** Camada 1 — chama Z-API para confirmar que o número tem WhatsApp.
   *  Z-API não expõe esse endpoint; retorna skipped silenciosamente. */
  async validateNumbers(phones: string[]): Promise<{ valid: string[]; invalid: string[]; skipped: boolean }> {
    if (!BULK_VALIDATE_NUMBERS) return { valid: phones, invalid: [], skipped: true };
    return this.zapi.checkWhatsappNumbers(phones);
  }

  /** Camada 2. */
  isWithinBusinessHours(now: Date = new Date()): boolean {
    const h = now.getHours();
    return h >= BULK_BUSINESS_HOURS_START && h < BULK_BUSINESS_HOURS_END;
  }

  /** Camada 3. */
  async randomDelay(): Promise<void> {
    const min = Math.min(BULK_DELAY_MIN_MS, BULK_DELAY_MAX_MS);
    const max = Math.max(BULK_DELAY_MIN_MS, BULK_DELAY_MAX_MS);
    const ms = Math.floor(min + Math.random() * (max - min));
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Camadas 4 e 5. */
  async canSendNow(): Promise<{ allowed: boolean; reason?: 'hourly' | 'daily' }> {
    const now = new Date();
    const hourlyAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const dailyAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const hourlyCount = await this.repo.count({
      where: {
        status: MoreThanOrEqual(WhatsappMessageStatus.SENT as any),
        createdAt: MoreThanOrEqual(hourlyAgo),
      } as any,
    });
    // O `MoreThanOrEqual` acima cobre SENT/DELIVERED/READ pela ordenação enum.
    if (hourlyCount >= BULK_HOURLY_LIMIT) return { allowed: false, reason: 'hourly' };
    const dailyCount = await this.repo.count({
      where: {
        status: MoreThanOrEqual(WhatsappMessageStatus.SENT as any),
        createdAt: MoreThanOrEqual(dailyAgo),
      } as any,
    });
    if (dailyCount >= BULK_DAILY_LIMIT) return { allowed: false, reason: 'daily' };
    return { allowed: true };
  }

  /** Camada 6 — usado em createBulk para randomizar scheduledAt entre destinatários. */
  jitterScheduledAt(now: Date = new Date()): Date {
    const offset = Math.floor(Math.random() * BULK_JITTER_MAX_MS);
    return new Date(now.getTime() + offset);
  }
}