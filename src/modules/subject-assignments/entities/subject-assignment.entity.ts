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
import { Section } from '../../sections/entities/section.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Teacher } from '../../teachers/entities/teacher.entity';

/** Mapped to the existing `public.subject_assignments` table (database-first). */
@Entity('subject_assignments')
export class SubjectAssignment {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'academic_session_id', type: 'uuid', nullable: true })
  academicSessionId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string | null;

  @ManyToOne(() => Teacher, (teacher) => teacher.subjectAssignments)
  @JoinColumn({ name: 'teacher_id' })
  teacher?: Teacher | null;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section?: Section | null;

  @ManyToOne(() => Subject)
  @JoinColumn({ name: 'subject_id' })
  subject?: Subject | null;

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
