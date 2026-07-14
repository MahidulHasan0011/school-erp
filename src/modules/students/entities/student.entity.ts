import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StudentEnrollment } from '../../student-enrollments/entities/student-enrollment.entity';
import { User } from '../../users/entities/user.entity';

/** Mapped to the existing `public.students` table (database-first). */
@Entity('students')
export class Student {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'STD-2025-0001' })
  @Column({ name: 'student_code', type: 'varchar', length: 30 })
  studentCode: string;

  @ApiPropertyOptional()
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'guardian_name', type: 'varchar', length: 100, nullable: true })
  guardianName: string | null;

  @ApiPropertyOptional()
  @Column({
    name: 'guardian_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  guardianPhone: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  address: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  // getWithEnrollment-এর জন্য
  @OneToMany(() => StudentEnrollment, (e) => e.student)
  enrollments: StudentEnrollment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
