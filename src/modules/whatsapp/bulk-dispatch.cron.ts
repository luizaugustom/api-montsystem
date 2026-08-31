import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BulkDispatchService } from './bulk-dispatch.service';

/**
 * Drenador da fila implícita em whatsapp_messages.status='QUEUED'.
 *
 * - A cada 20s verifica se está dentro da janela comercial e dos limites
 *   por hora/dia (camadas 2, 4 e 5 do AntiBanService). Se não estiver,
 *   deixa como está e tenta no próximo tick.
 * - A cada 5 min reprocessa mensagens FAILED com tentativas < BULK_MAX_ATTEMPTS.
 */
@Injectable()
export class BulkDispatchCron {
  private readonly logger = new Logger(BulkDispatchCron.name);

  constructor(private bulk: BulkDispatchService) {}

  @Cron('*/20 * * * * *')
  async drainQueue() {
    try {
      const r = await this.bulk.dispatchPending();
      if (r.processed > 0) {
        this.logger.log(`dispatchPending: processed=${r.processed} sent=${r.sent} failed=${r.failed}`);
      }
    } catch (e: any) {
      this.logger.error(`dispatchPending erro: ${e?.message}`);
    }
  }

  @Cron('0 */5 * * * *')
  async retryFailed() {
    try {
      const r = await this.bulk.retryFailed();
      if (r.retried > 0) {
        this.logger.log(`retryFailed: retried=${r.retried} sent=${r.sent} failed=${r.failed}`);
      }
    } catch (e: any) {
      this.logger.error(`retryFailed erro: ${e?.message}`);
    }
  }
}