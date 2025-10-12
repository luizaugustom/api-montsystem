import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('nfse')
export class NfseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ nullable: true })
  invoiceId?: number;

  @Column({ nullable: true })
  protocolo?: string;

  @Column({ nullable: true })
  nfseNumber?: string;

  @Column({ type: 'text' })
  xml!: string;

  @Column({ default: 'processing' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  response?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
