import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import { NfseEntity } from '../../nfse/entities/nfse.entity';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';
import { EmailService } from '../../../shared/services/email.service';
import { renderNfseAutorizada } from '../../../shared/templates/email/email-templates';
import { BillingNotificationsRepository } from '../billing-notifications.repository';
import { BillingNotificationKind } from '../entities/billing-notification.entity';

/**
 * Envia email (apenas email — sem WhatsApp) ao cliente quando uma NFSe é
 * autorizada. Anexa o PDF e o XML quando disponíveis.
 *
 * Idempotente via `billing_notifications` (UNIQUE mensalidade + kind).
 * Usa TypeORM direto para carregar o MonthlyCharge — evita ciclo com
 * MonthlyChargesModule (que importa BillingNotificationsModule).
 */
@Injectable()
export class NfseEmailListener {
  private readonly logger = new Logger(NfseEmailListener.name);

  constructor(
    private email: EmailService,
    private notifRepo: BillingNotificationsRepository,
    @InjectRepository(MonthlyCharge)
    private monthlyRepo: Repository<MonthlyCharge>,
  ) {}

  @OnEvent('nfse.authorized')
  async handleNfseAuthorized(payload: { nfse: NfseEntity; monthlyCharge?: MonthlyCharge }) {
    const { nfse, monthlyCharge } = payload || {};
    if (!nfse) return;
    if (!monthlyCharge) {
      this.logger.warn(`nfse.authorized sem monthlyCharge — pulando (nfse ${nfse.id})`);
      return;
    }

    // Carrega o cliente se não vier junto
    let charge = monthlyCharge;
    if (!charge.customer) {
      const reloaded = await this.monthlyRepo.findOne({
        where: { id: charge.id },
        relations: ['customer'],
      });
      if (!reloaded) {
        this.logger.warn(`Mensalidade ${monthlyCharge.id} não encontrada`);
        return;
      }
      charge = reloaded;
    }

    if (!charge.customer) {
      this.logger.warn(`Mensalidade ${monthlyCharge.id} sem cliente vinculado`);
      return;
    }

    const customer = charge.customer;

    // Idempotência
    const existing = await this.notifRepo.findExisting(
      charge.id,
      BillingNotificationKind.NFSE_AUTHORIZED,
    );
    if (existing) {
      this.logger.log(`NFSe já notificada para mensalidade ${charge.id} — pulando`);
      return;
    }

    if (!customer.email) {
      this.logger.warn(`Cliente ${customer.name} sem email — NFSe não enviada`);
      // Não cria notificação — pode ser reenviado depois que o email for cadastrado
      return;
    }

    const competencia = dayjs(charge.competencia).format('MM/YYYY');

    try {
      await this.email.sendCustom({
        to: customer.email,
        subject: `NFSe emitida — ${nfse.nfseNumber || `#${nfse.id}`} — ${competencia} — Mont System`,
        html: renderNfseAutorizada(nfse, customer, charge),
      });
    } catch (e: any) {
      this.logger.error(`Falha email NFSe ${nfse.id}: ${e?.message}`);
      // Não cria notificação em caso de erro — próxima autorização reentregará
      return;
    }

    await this.notifRepo.create({
      monthlyChargeId: charge.id,
      customerId: customer.id,
      kind: BillingNotificationKind.NFSE_AUTHORIZED,
      emailSent: true,
      whatsappSent: false, // explícito: este listener é email-only
    });

    this.logger.log(
      `📧 NFSe ${nfse.nfseNumber || nfse.id} enviada por email para ${customer.name} (mensalidade ${charge.id})`,
    );
  }
}
