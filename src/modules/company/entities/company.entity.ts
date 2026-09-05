import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Empresa (singleton).
 *
 * Persistida em Postgres porque ambientes como Vercel e DigitalOcean App
 * Platform têm filesystem efêmero (disco se perde a cada deploy/restart).
 * Modelada como tabela única com id fixo para manter o contrato externo
 * inalterado (CompanyService.get() / .save() continuam funcionando como antes).
 */
@Entity('companies')
export class Company {
  /** UUID fixo do singleton — usado para upsert no save(). */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: 'homologacao' })
  environment!: 'homologacao' | 'producao';

  @Column({ default: 'SP' })
  uf!: string;

  @Column({ type: 'jsonb' })
  company!: {
    cnpj: string;
    ie: string;
    /** Inscrição Municipal — exigida na emissão de NFSe. Não confundir com a IE (estadual). */
    im?: string;
    name: string;
    fantasy?: string;
    crt: number;
    address: {
      street: string;
      number: string;
      neighborhood: string;
      cep: string;
      city: string;
      cityCode: string;
      state: string;
      complement?: string;
    };
    contact: {
      phone?: string;
      email?: string;
    };
  };

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  certificate!: {
    path: string;
    password: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  email?: {
    host?: string;
    port?: number;
    secure?: boolean;
    user?: string;
    pass?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  paths?: {
    logo?: string;
    danfeTemplate?: string;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
