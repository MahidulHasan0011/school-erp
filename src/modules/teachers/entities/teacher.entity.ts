import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubjectAssignment } from '../../subject-assignments/entities/subject-assignment.entity';
import { User } from '../../users/entities/user.entity';

/** Mapped to the existing `public.teachers` table (database-first). */
@Entity('teachers')
export class Teacher {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 100, nullable: true })
  designation: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  qualification: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joiningDate: string | null;

  // teacher-এর login account (name/email এখান থেকে আসে)
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  // getWithAssignments-এর জন্য
  @OneToMany(() => SubjectAssignment, (sa) => sa.teacher)
  subjectAssignments: SubjectAssignment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
