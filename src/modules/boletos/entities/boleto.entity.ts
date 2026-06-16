import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';

export enum BoletoStatus {
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
}

@Entity('boletos')
@Index(['nossoNumero'], { unique: true })
export class Boleto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  nossoNumero!: string;

  @Column({ default: '756' })
  banco!: string;

  @Column({ type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ type: 'uuid', nullable: true })
  monthlyChargeId?: string;

  @Column({ type: 'integer' })
  valorCents!: number;

  @Column({ type: 'date' })
  vencimento!: string;

  @Column({ type: 'enum', enum: BoletoStatus, default: BoletoStatus.ISSUED })
  status!: BoletoStatus;

  @Column({ type: 'text', nullable: true })
  linhaDigitavel?: string;

  @Column({ type: 'text', nullable: true })
  codigoBarras?: string;

  @Column({ type: 'text', nullable: true })
  urlPdf?: string;

  @Column({ type: 'text', nullable: true })
  localPdfPath?: string;

  @Column({ type: 'text', nullable: true })
  urlXml?: string;

  @Column({ nullable: true })
  unimakeId?: string;

  @Column({ type: 'date', nullable: true })
  paidAt?: string;

  @Column({ type: 'integer', nullable: true })
  paidAmountCents?: number;

  @Column({ type: 'jsonb', nullable: true })
  payloadJson?: any;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get valor(): number {
    return this.valorCents / 100;
  }

  get paidAmount(): number | null {
    return this.paidAmountCents ? this.paidAmountCents / 100 : null;
  }
}
