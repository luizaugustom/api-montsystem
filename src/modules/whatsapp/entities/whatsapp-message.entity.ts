import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

export enum WhatsappDirection {
  OUTBOUND = 'OUTBOUND',
  INBOUND = 'INBOUND',
}

export enum WhatsappMessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

@Entity('whatsapp_messages')
@Index(['phone'])
@Index(['status'])
@Index(['createdAt'])
@Index(['scheduledAt'])
@Index(['dispatchId'])
export class WhatsappMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  customerId?: string;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ type: 'uuid', nullable: true })
  contactId?: string;

  @Column({ type: 'uuid', nullable: true })
  monthlyChargeId?: string;

  @Column({ type: 'enum', enum: WhatsappDirection, default: WhatsappDirection.OUTBOUND })
  direction!: WhatsappDirection;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  templateKey?: string;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: any;

  @Column({ type: 'enum', enum: WhatsappMessageStatus, default: WhatsappMessageStatus.QUEUED })
  status!: WhatsappMessageStatus;

  @Column({ nullable: true })
  providerMessageId?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  /** Quando o envio é agendado (campanha). Null para envios 1-a-1 imediatos. */
  @Column({ type: 'timestamp with time zone', nullable: true })
  scheduledAt?: Date | null;

  /** Identificador agrupador de uma campanha. Permite consultar status agregado. */
  @Column({ type: 'uuid', nullable: true })
  dispatchId?: string | null;

  /** Marca mensagens originadas de campanha (em massa) vs 1-a-1. */
  @Column({ default: false })
  isBulk!: boolean;

  /** Tentativas de reenvio após falha (incrementado pelo cron retryFailed). */
  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
