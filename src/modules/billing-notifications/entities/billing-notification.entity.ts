import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';
import { Customer } from '../../customers/entities/customer.entity';

export enum BillingNotificationKind {
  /** Boleto emitido automaticamente 5 dias antes do vencimento. */
  BOLETO_PRE_EMITTED = 'BOLETO_PRE_EMITTED',
  /** Aviso enviado no dia do vencimento do boleto. */
  DUE_DATE = 'DUE_DATE',
  /** Aviso enviado 5 dias após o vencimento (tom de desativação). */
  OVERDUE_5_DAYS = 'OVERDUE_5_DAYS',
  /** NFSe autorizada enviada por email ao cliente. */
  NFSE_AUTHORIZED = 'NFSE_AUTHORIZED',
}

/**
 * Log de notificações automáticas disparadas pelo fluxo de cobrança mensal.
 * UNIQUE(monthlyChargeId, kind) garante idempotência: o mesmo aviso não é
 * reenviado se o cron rodar mais de uma vez no mesmo dia.
 */
@Entity('billing_notifications')
@Index(['monthlyChargeId', 'kind'], { unique: true })
export class BillingNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  monthlyChargeId!: string;

  @ManyToOne(() => MonthlyCharge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monthlyChargeId' })
  monthlyCharge?: MonthlyCharge;

  @Column('uuid')
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ type: 'enum', enum: BillingNotificationKind })
  kind!: BillingNotificationKind;

  @CreateDateColumn()
  sentAt!: Date;

  @Column({ default: false })
  whatsappSent!: boolean;

  @Column({ default: false })
  emailSent!: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}
