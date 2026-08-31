import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { User } from './user.entity';
import type { Resource, Level } from '../../../shared/permissions/resources';
import { RESOURCES } from '../../../shared/permissions/resources';

@Entity('user_permissions')
@Unique('uq_user_permission_user_resource', ['userId', 'resource'])
export class UserPermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, (u) => u.permissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'enum', enum: RESOURCES })
  resource!: Resource;

  @Column({ type: 'enum', enum: ['view', 'edit'] })
  level!: Level;
}
