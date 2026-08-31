import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Categoria de despesa (ex.: Aluguel, Fornecedores, Folha, Impostos).
 * Tabela editável para padronizar filtros e relatórios entre usuários.
 */
@Entity('expense_categories')
export class ExpenseCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  /** Cor hexadecimal opcional para badges no UI (ex.: '#ef4444'). */
  @Column({ nullable: true })
  color?: string;

  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}