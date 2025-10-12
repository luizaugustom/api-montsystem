import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

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
  address?: string;

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
}
