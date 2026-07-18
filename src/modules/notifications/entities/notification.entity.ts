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

export enum NotificationType {
  GENERAL = 'GENERAL',
  LEAVE = 'LEAVE',
  EXAM = 'EXAM',
  ATTENDANCE = 'ATTENDANCE',
  RANKING = 'RANKING',
  SYSTEM = 'SYSTEM',
}

/**
 * Mapped to `public.notifications` (migration 011)।
 * Per-recipient model — প্রতিটা row একজন user-এর জন্য (recipient_id + is_read)।
 */
@Entity('notifications')
export class Notification {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ApiProperty({ default: NotificationType.GENERAL })
  @Column({ type: 'varchar', length: 50, default: NotificationType.GENERAL })
  type: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 150 })
  title: string;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({ default: false })
  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @ApiPropertyOptional()
  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @ApiPropertyOptional()
  @Column({ name: 'related_type', type: 'varchar', length: 50, nullable: true })
  relatedType: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'related_id', type: 'uuid', nullable: true })
  relatedId: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recipient_id' })
  recipient?: User;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
