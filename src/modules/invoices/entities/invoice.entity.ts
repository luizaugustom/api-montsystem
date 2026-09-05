import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';
import { InvoiceItem } from './invoice_item.entity';
import { Customer } from '../../customers/entities/customer.entity';
import { MonthlyCharge } from '../../monthly-charges/entities/monthly-charge.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',           // Rascunho
  PENDING = 'pending',       // Pendente de envio
  SENT = 'sent',            // Enviada para SEFAZ
  AUTHORIZED = 'authorized', // Autorizada
  CANCELLED = 'cancelled',   // Cancelada
  REJECTED = 'rejected'      // Rejeitada
}

export enum InvoiceType {
  NFE = 'nfe',         // Nota Fiscal Eletrônica
  NFCE = 'nfce',       // NFC-e (Consumidor)
  NFSE = 'nfse'        // Nota Fiscal de Serviços Eletrônica
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  number!: string; // Número da nota fiscal

  @Column()
  series!: string; // Série da nota fiscal

  @Column({ type: 'enum', enum: InvoiceType, default: InvoiceType.NFE })
  type!: InvoiceType;

  @Column({ nullable: true })
  accessKey?: string; // Chave de acesso (44 dígitos)

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @Column({ type: 'date' })
  issueDate!: string; // Data de emissão

  @Column({ type: 'date', nullable: true })
  dueDate?: string; // Data de vencimento

  @Column({ type: 'integer' })
  totalValueCents!: number; // Valor total em centavos

  @Column({ type: 'integer', nullable: true })
  taxValueCents?: number; // Valor dos impostos em centavos

  @Column({ type: 'integer', nullable: true })
  discountValueCents?: number; // Valor do desconto em centavos

  // Dados do cliente
  @Column()
  clientName!: string;

  @Column()
  clientDocument!: string; // CPF/CNPJ

  @Column({ nullable: true })
  clientEmail?: string;

  @Column({ type: 'text', nullable: true })
  clientAddress?: string;

  // Descrição dos itens/serviços
  @Column({ type: 'text' })
  description!: string;

  // Arquivos relacionados
  @Column({ nullable: true })
  xmlFilePath?: string; // Caminho do arquivo XML

  @Column({ nullable: true })
  pdfFilePath?: string; // Caminho do arquivo PDF

  // Relacionamento com Sale
  @Column({ nullable: true })
  saleId?: string;

  @ManyToOne(() => Sale, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'saleId' })
  sale?: Sale;

  // Vínculo direto com a mensalidade (quando a NFSe nasce de uma cobrança mensal).
  // `saleId` é auto-populado a partir de `monthlyCharge.saleId` quando a mensalidade
  // pertence a uma venda, para permitir listagens cruzadas.
  @Column({ type: 'uuid', nullable: true })
  monthlyChargeId?: string;

  @ManyToOne(() => MonthlyCharge, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'monthlyChargeId' })
  monthlyCharge?: MonthlyCharge;

  // Tomador da NFSe — fonte estruturada do cliente (endereço, CPF/CNPJ).
  // Denormalizado em clientName/clientDocument/clientAddress para a tabela/listagem.
  @Column({ nullable: true })
  customerId?: string;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customerId' })
  customer?: Customer;

  // Itens da nota
  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items?: InvoiceItem[];

  // Dados da SEFAZ
  @Column({ nullable: true })
  protocolNumber?: string; // Número do protocolo de autorização

  @Column({ type: 'text', nullable: true })
  sefazResponse?: string; // Resposta completa da SEFAZ

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string; // Motivo da rejeição/cancelamento

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Getters para expor valores em reais
  get totalValue(): number {
    return this.totalValueCents / 100;
  }

  get taxValue(): number | null {
    return this.taxValueCents ? this.taxValueCents / 100 : null;
  }

  get discountValue(): number | null {
    return this.discountValueCents ? this.discountValueCents / 100 : null;
  }
}
