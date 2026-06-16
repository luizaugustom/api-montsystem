import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserPermission } from './user-permission.entity';

export type UserRole = 'admin' | 'user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  passwordHash!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ type: 'enum', enum: ['admin', 'user'], default: 'user' })
  role!: UserRole;

  @Column({ default: true })
  active!: boolean;

  /**
   * Versão do token de sessão. Incrementada em mudança de senha, desativação
   * ou logout forçado. Comparada com a do JWT a cada request pelo AuthGuard —
   * valores diferentes invalidam todos os tokens existentes do usuário.
   */
  @Column({ default: 0 })
  tokenVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => UserPermission, (perm) => perm.user, { cascade: true })
  permissions?: UserPermission[];
}
