import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';

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

  @OneToMany(() => MonthlyCharge, (charge) => charge.sale)
  monthlyCharges?: MonthlyCharge[];

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
