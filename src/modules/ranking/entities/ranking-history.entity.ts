import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Mapped to `public.ranking_history` (database-first).
 * প্রতিবার rank generate/recalculate-এর immutable snapshot (version সহ)।
 * NOTE: created/updated/deleted নেই — শুধু generated_at।
 */
@Entity('ranking_history')
export class RankingHistory {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'academic_session_id', type: 'uuid' })
  academicSessionId: string;

  @ApiProperty()
  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ApiProperty()
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ApiProperty()
  @Column({
    name: 'total_score',
    type: 'numeric',
    precision: 7,
    scale: 2,
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? 0 : parseFloat(v)),
    },
  })
  totalScore: number;

  @ApiProperty()
  @Column({ name: 'rank_position', type: 'integer' })
  rankPosition: number;

  @ApiProperty()
  @Column({ name: 'roll_number', type: 'integer' })
  rollNumber: number;

  @ApiProperty({ default: 1 })
  @Column({ type: 'integer', default: 1 })
  version: number;

  @ApiProperty()
  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;
}
