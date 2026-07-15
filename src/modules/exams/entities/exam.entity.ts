import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AcademicSession } from '../../academic-sessions/entities/academic-session.entity';
import { ClassEntity } from '../../classes/entities/class.entity';

export enum ExamType {
  ADMISSION = 'ADMISSION',
  MIDTERM = 'MIDTERM',
  FINAL = 'FINAL',
  UNIT_TEST = 'UNIT_TEST',
}

export enum ExamStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

/** Mapped to the existing `public.exams` table (database-first). */
@Entity('exams')
export class Exam {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Midterm Exam 2025' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiPropertyOptional()
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'academic_session_id', type: 'uuid', nullable: true })
  academicSessionId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'exam_date', type: 'date', nullable: true })
  examDate: string | null;

  @ApiProperty({ enum: ExamType, default: ExamType.ADMISSION })
  @Column({
    name: 'exam_type',
    type: 'enum',
    enum: ExamType,
    enumName: 'exam_type_enum',
    default: ExamType.ADMISSION,
  })
  examType: ExamType;

  @ApiProperty({ enum: ExamStatus, default: ExamStatus.DRAFT })
  @Column({
    type: 'enum',
    enum: ExamStatus,
    enumName: 'exam_status_enum',
    default: ExamStatus.DRAFT,
  })
  status: ExamStatus;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @ManyToOne(() => AcademicSession)
  @JoinColumn({ name: 'academic_session_id' })
  academicSession?: AcademicSession | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
