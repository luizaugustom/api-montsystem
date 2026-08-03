import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Boleto } from '../../boletos/entities/boleto.entity';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  cpfOrCnpj?: string;

  @Column({ nullable: true })
  tradeName?: string;

  @Column({ nullable: true })
  cep?: string;

  @Column({ nullable: true })
  street?: string;

  @Column({ nullable: true })
  number?: string;

  @Column({ nullable: true })
  complement?: string;

  @Column({ nullable: true })
  neighborhood?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ type: 'date', nullable: true })
  acquisitionDate?: string;

  @Column({ type: 'decimal', nullable: true })
  entryValue?: number;

  @Column({ type: 'decimal', nullable: true })
  monthlyValue?: number;

  @Column({ type: 'date', nullable: true })
  nextPaymentDate?: string;

  @Column({ nullable: true })
  productDescription?: string;

  @Column({ type: 'simple-json', nullable: true })
  invoices?: string[];

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => Boleto, (boleto) => boleto.customer)
  boletos?: Boleto[];

  @OneToMany(() => MonthlyCharge, (charge) => charge.customer)
  monthlyCharges?: MonthlyCharge[];
}
