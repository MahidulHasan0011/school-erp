import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 001_roll_rank_system.sql — ranking_audit_log টেবিল + ranking_action_enum।
 *
 * পুরনো raw SQL হুবহু queryRunner.query()-তে বসানো হয়েছে; TypeORM শুধু চালায়।
 * ক্লাসের নামের শুরুতে থাকা সংখ্যা (timestamp) = migration order।
 */
export class RankingAuditLog1717000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ranking_action_enum AS ENUM (
          'GENERATE', 'RECALCULATE', 'UNLOCK', 'LOCK', 'AUTO_TRIGGER', 'AUTO_TRIGGER_SKIP'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.ranking_audit_log (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        action ranking_action_enum NOT NULL,
        class_id uuid NOT NULL,
        academic_session_id uuid NOT NULL,
        actor_id uuid,
        from_version integer,
        to_version integer,
        detail jsonb,
        created_at timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT ranking_audit_log_pkey PRIMARY KEY (id),
        CONSTRAINT ranking_audit_log_class_id_fkey
          FOREIGN KEY (class_id) REFERENCES public.classes (id),
        CONSTRAINT ranking_audit_log_session_id_fkey
          FOREIGN KEY (academic_session_id) REFERENCES public.academic_sessions (id),
        CONSTRAINT ranking_audit_log_actor_id_fkey
          FOREIGN KEY (actor_id) REFERENCES public.users (id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ranking_audit_class_session
        ON public.ranking_audit_log (class_id, academic_session_id, created_at DESC);
    `);
  }

  // down() = up()-এর উল্টো। migration:revert চালালে এটা চলে।
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.ranking_audit_log;`);
    await queryRunner.query(`DROP TYPE IF EXISTS ranking_action_enum;`);
  }
}
