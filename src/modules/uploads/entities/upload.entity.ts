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

export enum UploadCategory {
  STUDENT_PROFILE = 'STUDENT_PROFILE',
  TEACHER_PROFILE = 'TEACHER_PROFILE',
  SCHOOL_LOGO = 'SCHOOL_LOGO',
  ASSIGNMENT = 'ASSIGNMENT',
  QUESTION_PAPER = 'QUESTION_PAPER',
  ANSWER_SHEET = 'ANSWER_SHEET',
  EXAM_ATTACHMENT = 'EXAM_ATTACHMENT',
  LEAVE_ATTACHMENT = 'LEAVE_ATTACHMENT',
  ATTENDANCE_PROOF = 'ATTENDANCE_PROOF',
  CERTIFICATE = 'CERTIFICATE',
  NOTICE_ATTACHMENT = 'NOTICE_ATTACHMENT',
  OTHER = 'OTHER',
}

export enum UploadStatus {
  PENDING = 'PENDING',
  READY = 'READY',
  FAILED = 'FAILED',
}

/**
 * Mapped to `public.uploads` (database-first)।
 * pre-signed URL ভিত্তিক upload: প্রথমে PENDING row + PUT url দেওয়া হয়,
 * client সরাসরি S3-তে upload করে, তারপর confirm করলে READY হয়।
 */
@Entity('uploads')
export class Upload {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ name: 'storage_key', type: 'varchar', length: 512, unique: true })
  storageKey: string;

  @ApiProperty()
  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @ApiProperty()
  @Column({ name: 'mime_type', type: 'varchar', length: 127 })
  mimeType: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 16 })
  extension: string;

  // bigint — TypeORM string হিসেবে ফেরত দেয়, তাই number-এ transform
  @ApiProperty()
  @Column({
    name: 'file_size',
    type: 'bigint',
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? 0 : parseInt(v, 10)),
    },
  })
  fileSize: number;

  @ApiProperty({ enum: UploadCategory })
  @Column({
    type: 'enum',
    enum: UploadCategory,
    enumName: 'upload_category_enum',
  })
  category: UploadCategory;

  @ApiProperty({ enum: UploadStatus, default: UploadStatus.PENDING })
  @Column({
    type: 'enum',
    enum: UploadStatus,
    enumName: 'upload_status_enum',
    default: UploadStatus.PENDING,
  })
  status: UploadStatus;

  @ApiProperty()
  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  @ApiPropertyOptional()
  @Column({ type: 'varchar', length: 128, nullable: true })
  checksum: string | null;

  @ApiProperty()
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata: Record<string, unknown>;

  @ApiPropertyOptional()
  @Column({ name: 'related_type', type: 'varchar', length: 50, nullable: true })
  relatedType: string | null;

  @ApiPropertyOptional()
  @Column({ name: 'related_id', type: 'uuid', nullable: true })
  relatedId: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader?: User | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
