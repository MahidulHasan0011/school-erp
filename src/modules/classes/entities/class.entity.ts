import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Section } from '../../sections/entities/section.entity';

/** Mapped to the existing `public.classes` table (database-first). */
@Entity('classes')
export class ClassEntity {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Class 6' })
  @Column({ type: 'varchar', length: 50 })
  name: string;

  // getWithSections-এর জন্য
  @OneToMany(() => Section, (section) => section.class)
  sections: Section[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
