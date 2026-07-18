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
import { User } from '../../users/entities/user.entity';

export enum LeaveType {
  SICK = 'SICK',
  CASUAL = 'CASUAL',
  ANNUAL = 'ANNUAL',
  MATERNITY = 'MATERNITY',
  UNPAID = 'UNPAID',
  OTHER = 'OTHER',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Mapped to `public.leaves` (database-first, BaseSchema)।
 * status/leave_type DB-তে varchar — TS enum দিয়ে validate করা হয়।
 */
@Entity('leaves')
export class Leave {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ApiPropertyOptional({ enum: LeaveType })
  @Column({ name: 'leave_type', type: 'varchar', length: 50, nullable: true })
  leaveType: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @ApiProperty({ enum: LeaveStatus, default: LeaveStatus.PENDING })
  @Column({ type: 'varchar', length: 20, default: LeaveStatus.PENDING })
  status: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
