import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

/**
 * Mapped to the existing `public.users` table (database-first).
 * Column names are snake_case in the DB, so each is declared explicitly.
 */
@Entity('users')
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'full_name', type: 'varchar' })
  fullName: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email: string;

  // select:false — never returned unless explicitly requested (auth flow)
  @Column({ type: 'text', select: false })
  password: string;

  @ApiPropertyOptional()
  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  // Read-only relation; the FK is owned by the roleId column above.
  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role?: Role | null;

  @ApiProperty({ default: true })
  @Column({ name: 'is_active', type: 'boolean', default: true, nullable: true })
  isActive: boolean;

  @ApiPropertyOptional({ enum: Gender, default: Gender.MALE })
  @Column({
    type: 'enum',
    enum: Gender,
    enumName: 'gender_enum',
    default: Gender.MALE,
    nullable: true,
  })
  gender: Gender | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Soft-delete column already present in the table
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
