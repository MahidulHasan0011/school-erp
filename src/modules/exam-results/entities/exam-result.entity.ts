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
import { Exam } from '../../exams/entities/exam.entity';
import { Student } from '../../students/entities/student.entity';
import { Subject } from '../../subjects/entities/subject.entity';

/**
 * Mapped to `public.exam_results` (database-first).
 * UNIQUE (exam_id, student_id, subject_id) — প্রতি বিষয়ে একটি ফলাফল।
 */
@Entity('exam_results')
export class ExamResult {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'exam_id', type: 'uuid', nullable: true })
  examId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  // numeric(5,2) — TypeORM এটিকে string হিসেবে ফেরত দেয়, তাই number-এ transform
  @ApiPropertyOptional()
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
    },
  })
  marks: number | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 5, nullable: true })
  grade: string | null;

  @ManyToOne(() => Exam)
  @JoinColumn({ name: 'exam_id' })
  exam?: Exam | null;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}