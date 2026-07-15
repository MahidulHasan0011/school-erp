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

/**
 * Mapped to `public.attendance_logs` (database-first) — staff check-in/out log।
 * প্রতি user + date-এ একটি করে সারি (এই module সেই invariant enforce করে)।
 */
@Entity('attendance_logs')
export class AttendanceLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ApiProperty()
  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @ApiPropertyOptional()
  @Column({ name: 'check_in', type: 'timestamp', nullable: true })
  checkIn: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'check_out', type: 'timestamp', nullable: true })
  checkOut: Date | null;

  @ApiProperty({ default: 0 })
  @Column({ name: 'total_work_minutes', type: 'integer', default: 0 })
  totalWorkMinutes: number;

  @ApiProperty({ default: 'PRESENT' })
  @Column({ type: 'varchar', length: 20, default: 'PRESENT' })
  status: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'ip_address', type: 'text', nullable: true })
  ipAddress: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'check_in_latitude', type: 'numeric', nullable: true })
  checkInLatitude: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'check_in_longitude', type: 'numeric', nullable: true })
  checkInLongitude: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'check_out_latitude', type: 'numeric', nullable: true })
  checkOutLatitude: number | null;

  @ApiPropertyOptional()
  @Column({ name: 'check_out_longitude', type: 'numeric', nullable: true })
  checkOutLongitude: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}