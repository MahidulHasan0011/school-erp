import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Mapped to `public.error_logs` (database-first)।
 * global error handler unhandled (500/non-operational) error এখানে জমা করে।
 * NOTE: updated_at নেই — শুধু created_at + deleted_at (soft-delete)।
 */
@Entity('error_logs')
export class ErrorLog {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @ApiProperty()
  @Column({ type: 'text' })
  message: string;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  stack: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'status_code', type: 'integer', nullable: true })
  statusCode: number | null;

  @ApiProperty({ default: false })
  @Column({ name: 'is_operational', type: 'boolean', default: false })
  isOperational: boolean;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'text', nullable: true })
  path: string | null;

  @ApiPropertyOptional()
  @Column({ type: 'jsonb', nullable: true })
  context: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
