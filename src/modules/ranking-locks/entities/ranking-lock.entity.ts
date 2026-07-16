import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicSession } from '../../academic-sessions/entities/academic-session.entity';
import { ClassEntity } from '../../classes/entities/class.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Mapped to `public.ranking_locks` (database-first).
 * প্রতি class+session-এ একটি করে সারি (UNIQUE)। lock হলে roll/rank আর
 * পরিবর্তন করা যায় না — unlock করলে আবার recalculate সম্ভব।
 *
 * NOTE: এই টেবিলে deleted_at নেই, তাই soft-delete নেই।
 */
@Entity('ranking_locks')
export class RankingLock {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ApiProperty()
  @Column({ name: 'academic_session_id', type: 'uuid' })
  academicSessionId: string;

  @ApiProperty({ default: false })
  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'locked_by', type: 'uuid', nullable: true })
  lockedBy: string | null;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @ManyToOne(() => AcademicSession)
  @JoinColumn({ name: 'academic_session_id' })
  academicSession?: AcademicSession | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'locked_by' })
  lockedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
