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
import { ClassEntity } from '../../classes/entities/class.entity';
import { Section } from '../../sections/entities/section.entity';
import { Student } from '../../students/entities/student.entity';

export enum StudentAttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

/**
 * Mapped to `public.student_attendance` (database-first).
 * status একটি varchar (DB-তে CHECK constraint), তাই enum নয় — string।
 */
@Entity('student_attendance')
export class StudentAttendance {
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
  @Column({ name: 'attendance_date', type: 'date', nullable: true })
  attendanceDate: string | null;

  @ApiPropertyOptional({ enum: StudentAttendanceStatus })
  @Column({ type: 'varchar', length: 20, nullable: true })
  status: string | null;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'student_id' })
  student?: Student | null;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @ManyToOne(() => Section)
  @JoinColumn({ name: 'section_id' })
  section?: Section | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}