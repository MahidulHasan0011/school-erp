import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum RankingAction {
  GENERATE = 'GENERATE',
  RECALCULATE = 'RECALCULATE',
  UNLOCK = 'UNLOCK',
  LOCK = 'LOCK',
  AUTO_TRIGGER = 'AUTO_TRIGGER',
  AUTO_TRIGGER_SKIP = 'AUTO_TRIGGER_SKIP',
}

/** Mapped to `public.ranking_audit_log` (database-first) — কে/কখন/কী action। */
@Entity('ranking_audit_log')
export class RankingAuditLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ enum: RankingAction })
  @Column({ type: 'enum', enum: RankingAction, enumName: 'ranking_action_enum' })
  action: RankingAction;

  @ApiProperty()
  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ApiProperty()
  @Column({ name: 'academic_session_id', type: 'uuid' })
  academicSessionId: string;

  @ApiPropertyOptional()
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'from_version', type: 'integer', nullable: true })
  fromVersion: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'to_version', type: 'integer', nullable: true })
  toVersion: number | null;

  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  detail: Record<string, unknown> | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
