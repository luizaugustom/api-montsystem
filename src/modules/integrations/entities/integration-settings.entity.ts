import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import type { IntegrationsData } from '../integrations-storage';

/**
 * Integrações (singleton).
 *
 * Persistidas em Postgres porque o filesystem em App Platform / Vercel é
 * efêmero — integrations.json se perde a cada deploy/restart.
 */
@Entity('integrations')
export class IntegrationSettings {
  /** UUID fixo do singleton. */
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'jsonb' })
  data!: IntegrationsData;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
