import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { Boleto } from '../../boletos/entities/boleto.entity';

export enum MonthlyChargeStatus {
  PENDING = 'PENDING',
  BOLETO_ISSUED = 'BOLETO_ISSUED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  NFSE_ISSUED = 'NFSE_ISSUED',
}

@Entity('monthly_charges')
@Index(['customerId', 'competencia'], { unique: true })
export class MonthlyCharge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  @Column({ type: 'uuid', nullable: true })
  saleId?: string;

  @ManyToOne(() => Sale, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'saleId' })
  sale?: Sale;

  @Column({ type: 'date' })
  competencia!: string; // primeiro dia do mês de referência

  @Column({ type: 'integer' })
  valorCents!: number;

  @Column({ type: 'date' })
  vencimento!: string;

  @Column({ type: 'enum', enum: MonthlyChargeStatus, default: MonthlyChargeStatus.PENDING })
  status!: MonthlyChargeStatus;

  @Column({ type: 'uuid', nullable: true })
  boletoId?: string;

  @OneToOne(() => Boleto, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'boletoId' })
  boleto?: Boleto;

  @Column({ type: 'integer', nullable: true })
  nfseId?: number; // referencia NfseEntity.id (nao eh FK formal pois NfseEntity usa increment)

  @Column({ type: 'date', nullable: true })
  paidAt?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get valor(): number {
    return this.valorCents / 100;
  }
}
