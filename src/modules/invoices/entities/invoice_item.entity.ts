import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  invoiceId!: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice;

  @Column()
  codigo!: string;

  @Column()
  descricao!: string;

  @Column()
  ncm!: string;

  @Column()
  cfop!: string;

  @Column()
  unidade!: string;

  @Column('decimal', { precision: 15, scale: 4, default: 0 })
  quantidade!: number;

  @Column('integer')
  valorUnitarioCents!: number;

  @Column('integer')
  valorTotalCents!: number;

  // Impostos básicos (opcionais)
  @Column({ nullable: true })
  icmsOrigem?: string;

  @Column({ nullable: true })
  icmsCst?: string;

  @Column('decimal', { precision: 7, scale: 2, nullable: true })
  icmsAliquota?: number | null;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  icmsValor?: number | null;
}