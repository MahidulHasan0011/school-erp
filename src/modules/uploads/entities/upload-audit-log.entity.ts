import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Upload } from './upload.entity';

export enum UploadAction {
  GENERATE_URL = 'GENERATE_URL',
  CONFIRM = 'CONFIRM',
  DOWNLOAD = 'DOWNLOAD',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
}

/** Mapped to `public.upload_audit_logs` (database-first) — কে/কখন/কী action। */
@Entity('upload_audit_logs')
export class UploadAuditLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'upload_id', type: 'uuid' })
  uploadId: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30 })
  action: string;

  @ApiPropertyOptional()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @ApiProperty()
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  detail: Record<string, unknown>;

  @ManyToOne(() => Upload)
  @JoinColumn({ name: 'upload_id' })
  upload?: Upload;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'actor_id' })
  actor?: User | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
