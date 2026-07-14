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
import { Student } from '../../students/entities/student.entity';

export enum EnrollmentType {
  OLD = 'OLD',
  NEW = 'NEW',
}

/** Mapped to the existing `public.student_enrollments` table (database-first). */
@Entity('student_enrollments')
export class StudentEnrollment {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'student_id', type: 'uuid', nullable: true })
  studentId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'section_id', type: 'uuid', nullable: true })
  sectionId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'academic_session_id', type: 'uuid', nullable: true })
  academicSessionId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'roll_number', type: 'integer', nullable: true })
  rollNumber: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'admission_date', type: 'date', nullable: true })
  admissionDate: string | null;

  @ApiProperty({ default: false })
  @Column({ name: 'ranking_locked', type: 'boolean', default: false })
  rankingLocked: boolean;

  @ApiProperty({ enum: EnrollmentType, default: EnrollmentType.OLD })
  @Column({
    name: 'enrollment_type',
    type: 'enum',
    enum: EnrollmentType,
    enumName: 'enrollment_type_enum',
    default: EnrollmentType.OLD,
  })
  enrollmentType: EnrollmentType;

  @ManyToOne(() => Student, (student) => student.enrollments)
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section?: Section | null;

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
