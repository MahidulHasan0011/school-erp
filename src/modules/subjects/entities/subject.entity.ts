import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Mapped to the existing `public.subjects` table (database-first). */
@Entity('subjects')
export class Subject {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Mathematics' })
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ApiPropertyOptional({ example: 'MATH' })
  @Column({ type: 'varchar', length: 20, nullable: true })
  code: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
