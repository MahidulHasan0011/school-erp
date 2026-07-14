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

/** Mapped to the existing `public.sections` table (database-first). */
@Entity('sections')
export class Section {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiPropertyOptional()
  @Column({ name: 'class_id', type: 'uuid', nullable: true })
  classId: string | null;

  @ApiProperty({ example: 'A' })
  @Column({ type: 'varchar', length: 20 })
  name: string;

  @ApiPropertyOptional()
  @Column({ name: 'max_capacity', type: 'integer', nullable: true })
  maxCapacity: number | null;

  @ManyToOne(() => ClassEntity)
  @JoinColumn({ name: 'class_id' })
  class?: ClassEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
