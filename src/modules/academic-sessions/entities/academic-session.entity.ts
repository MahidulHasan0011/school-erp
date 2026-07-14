import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Mapped to the existing `public.academic_sessions` table (database-first). */
@Entity('academic_sessions')
export class AcademicSession {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: '2025-2026' })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  @ApiPropertyOptional()
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @ApiProperty({ default: false })
  @Column({ name: 'is_active', type: 'boolean', default: false, nullable: true })
  isActive: boolean;

  @ApiProperty({ default: true })
  @Column({
    name: 'admission_test_enabled',
    type: 'boolean',
    default: true,
    nullable: true,
  })
  admissionTestEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
