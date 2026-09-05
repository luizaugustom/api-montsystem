import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';
import { Boleto } from '../../boletos/entities/boleto.entity';

export enum SaleStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  clientName!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  cpfOrCnpj?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ type: 'date', nullable: true })
  saleDate?: string;

  @Column({ type: 'date', nullable: true })
  warrantyEndDate?: string;

  @Column({ nullable: true })
  productDescription?: string;

  @Column({ nullable: true })
  contractFile?: string;

  @Column({ nullable: true })
  invoiceFile?: string;

  // Campos de valor da venda
  @Column({ type: 'integer', nullable: true })
  saleValueCents?: number; // valor em centavos para evitar problemas de float

  @Column({ type: 'boolean', default: false })
  isMonthly!: boolean; // true se é assinatura/mensalidade

  @Column({ type: 'integer', nullable: true })
  entryValueCents?: number; // valor de entrada em centavos (para cliente mensal)

  @Column({ type: 'integer', nullable: true })
  monthlyValueCents?: number; // valor da mensalidade em centavos

  @Column({ type: 'date', nullable: true })
  nextPaymentDate?: string;

  @Column({ nullable: true })
  clientId?: string; // ID do cliente (pode ser usado para relacionamento futuro)

  // Lifecycle: a venda começa PENDING e vira PAID quando o pagamento é confirmado.
  // Para venda mensalista: a confirmação vem do listener que detecta todos os
  // MonthlyCharge pagos. Para venda avulsa: endpoint manual POST /sales/:id/mark-paid.
  @Column({ type: 'enum', enum: SaleStatus, default: SaleStatus.PENDING })
  status!: SaleStatus;

  @Column({ type: 'date', nullable: true })
  paidAt?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => MonthlyCharge, (charge) => charge.sale)
  monthlyCharges?: MonthlyCharge[];

  // Boletos diretamente vinculados à venda (boletos avulsos para esta venda).
  // Boletos nascidos de mensalidade ficam só em monthly_charges.boletoId.
  @OneToMany(() => Boleto, (b) => b.sale)
  boletos?: Boleto[];

  // Getters para expor valores como number (em reais)
  get saleValue(): number | null {
    return this.saleValueCents ? this.saleValueCents / 100 : null;
  }

  get entryValue(): number | null {
    return this.entryValueCents ? this.entryValueCents / 100 : null;
  }

  get monthlyValue(): number | null {
    return this.monthlyValueCents ? this.monthlyValueCents / 100 : null;
  }
}
