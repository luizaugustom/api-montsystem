import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum NfseProvider {
  FOCUS_NFE = 'FOCUS_NFE',
}

export enum NfseStatus {
  PROCESSING = 'processing',
  AUTHORIZED = 'authorized',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  ERROR = 'error',
}

@Entity('nfse')
export class NfseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ nullable: true })
  invoiceId?: number;

  @Column({ nullable: true })
  monthlyChargeId?: string;

  @Column({ nullable: true })
  ref?: string;

  @Column({ default: NfseProvider.FOCUS_NFE })
  provider!: string;

  @Column({ default: NfseStatus.PROCESSING })
  status!: string;

  @Column({ nullable: true })
  protocolo?: string;

  @Column({ nullable: true })
  nfseNumber?: string;

  @Column({ type: 'text' })
  xml!: string;

  @Column({ type: 'text', nullable: true })
  response?: string;

  @Column({ type: 'text', nullable: true })
  urlPdf?: string;

  @Column({ type: 'text', nullable: true })
  urlXml?: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'jsonb', nullable: true })
  payloadJson?: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
