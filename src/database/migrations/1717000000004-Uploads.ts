import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 004_uploads.sql — File Management System (pre-signed URL ভিত্তিক)।
 *
 * ⚠️ এখানে শুধু SCHEMA (enums + টেবিল + index) রাখা হয়েছে।
 * পুরনো SQL-এর UPLOAD_* permissions + role_permissions INSERT গুলো
 * seed.sql-এ সরানো হয়েছে (কারণ ওগুলো roles seed-এর উপর নির্ভরশীল, DDL নয়)।
 */
export class Uploads1717000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE upload_category_enum AS ENUM (
          'STUDENT_PROFILE', 'TEACHER_PROFILE', 'SCHOOL_LOGO', 'ASSIGNMENT',
          'QUESTION_PAPER', 'ANSWER_SHEET', 'EXAM_ATTACHMENT', 'LEAVE_ATTACHMENT',
          'ATTENDANCE_PROOF', 'CERTIFICATE', 'NOTICE_ATTACHMENT', 'OTHER'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE upload_status_enum AS ENUM ('PENDING', 'READY', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // uploads টেবিল
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.uploads (
        id            uuid NOT NULL DEFAULT gen_random_uuid(),
        storage_key   varchar(512) NOT NULL,
        original_name varchar(255) NOT NULL,
        mime_type     varchar(127) NOT NULL,
        extension     varchar(16)  NOT NULL,
        file_size     bigint       NOT NULL,
        category      upload_category_enum NOT NULL,
        status        upload_status_enum   NOT NULL DEFAULT 'PENDING',
        uploaded_by   uuid NOT NULL,
        checksum      varchar(128),
        metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
        related_type  varchar(50),
        related_id    uuid,
        created_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at    timestamp without time zone,
        CONSTRAINT uploads_pkey PRIMARY KEY (id),
        CONSTRAINT uploads_storage_key_key UNIQUE (storage_key),
        CONSTRAINT uploads_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users (id)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploads_uploaded_by ON public.uploads (uploaded_by) WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploads_category    ON public.uploads (category)    WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploads_status      ON public.uploads (status);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploads_created_at  ON public.uploads (created_at DESC);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_uploads_related     ON public.uploads (related_type, related_id) WHERE related_id IS NOT NULL;`);

    // upload_audit_logs টেবিল
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.upload_audit_logs (
        id          uuid NOT NULL DEFAULT gen_random_uuid(),
        upload_id   uuid NOT NULL,
        action      varchar(30) NOT NULL,
        actor_id    uuid,
        ip_address  varchar(45),
        user_agent  text,
        detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT upload_audit_logs_pkey PRIMARY KEY (id),
        CONSTRAINT upload_audit_logs_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES public.uploads (id),
        CONSTRAINT upload_audit_logs_actor_id_fkey   FOREIGN KEY (actor_id)  REFERENCES public.users (id)
      );
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upload_audit_upload  ON public.upload_audit_logs (upload_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upload_audit_actor   ON public.upload_audit_logs (actor_id);`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_upload_audit_created ON public.upload_audit_logs (created_at DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.upload_audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.uploads;`);
    await queryRunner.query(`DROP TYPE IF EXISTS upload_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS upload_category_enum;`);
  }
}
