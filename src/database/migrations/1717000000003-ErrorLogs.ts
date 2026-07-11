import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 003_error_logs.sql — server-side error/exception-এর persistent trail।
 *
 * global error handler unhandled (500/non-operational) error এখানে জমা করে।
 * শুধু নতুন টেবিল যোগ হয়; user_id → users(id) FK (ON DELETE SET NULL)।
 */
export class ErrorLogs1717000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.error_logs (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name varchar(100),
        message text NOT NULL,
        stack text,
        status_code integer,
        is_operational boolean NOT NULL DEFAULT false,
        method varchar(10),
        path text,
        context jsonb,
        user_id uuid,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at timestamp without time zone,
        CONSTRAINT error_logs_pkey PRIMARY KEY (id),
        CONSTRAINT error_logs_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_created_at
        ON public.error_logs (created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_status_code
        ON public.error_logs (status_code);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_error_logs_user_id
        ON public.error_logs (user_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.error_logs;`);
  }
}
