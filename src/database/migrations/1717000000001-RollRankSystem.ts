import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 001_roll_rank_system.sql — Roll & Rank generation system-এর schema additions।
 *
 * পুরনো raw SQL হুবহু বসানো হয়েছে। সব ALTER আগের টেবিলের উপর নির্ভরশীল,
 * তাই এটা BaseSchema migration-এর পরে চলতে হবে (timestamp বড়)।
 */
export class RollRankSystem1717000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // exam_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE exam_status_enum AS ENUM ('DRAFT', 'PUBLISHED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // exams.status — default DRAFT, publish না করলে result গণনায় আসবে না
    await queryRunner.query(`
      ALTER TABLE public.exams
        ADD COLUMN IF NOT EXISTS status exam_status_enum NOT NULL DEFAULT 'DRAFT';
    `);

    // student_enrollments: admission_date + ranking_locked
    await queryRunner.query(`
      ALTER TABLE public.student_enrollments
        ADD COLUMN IF NOT EXISTS admission_date date,
        ADD COLUMN IF NOT EXISTS ranking_locked boolean NOT NULL DEFAULT false;
    `);

    // পুরনো রেকর্ডে admission_date ফাঁকা থাকলে created_at দিয়ে backfill
    await queryRunner.query(`
      UPDATE public.student_enrollments
      SET admission_date = created_at::date
      WHERE admission_date IS NULL;
    `);

    // ranking_locks — per class+session lock
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.ranking_locks (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        class_id uuid NOT NULL,
        academic_session_id uuid NOT NULL,
        is_locked boolean NOT NULL DEFAULT false,
        locked_at timestamp without time zone,
        locked_by uuid,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ranking_locks_pkey PRIMARY KEY (id),
        CONSTRAINT ranking_locks_class_session_key UNIQUE (class_id, academic_session_id),
        CONSTRAINT ranking_locks_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes (id),
        CONSTRAINT ranking_locks_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES public.academic_sessions (id),
        CONSTRAINT ranking_locks_locked_by_fkey FOREIGN KEY (locked_by) REFERENCES public.users (id)
      );
    `);

    // ranking_history — প্রতিবার rank generate/recalculate-এর snapshot
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.ranking_history (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        academic_session_id uuid NOT NULL,
        class_id uuid NOT NULL,
        student_id uuid NOT NULL,
        total_score numeric(7, 2) NOT NULL,
        rank_position integer NOT NULL,
        roll_number integer NOT NULL,
        version integer NOT NULL DEFAULT 1,
        generated_at timestamp without time zone NOT NULL DEFAULT now(),
        CONSTRAINT ranking_history_pkey PRIMARY KEY (id),
        CONSTRAINT ranking_history_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES public.academic_sessions (id),
        CONSTRAINT ranking_history_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes (id),
        CONSTRAINT ranking_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students (id)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ranking_history_class_session
        ON public.ranking_history (class_id, academic_session_id, version);
    `);
  }

  // down() = up()-এর উল্টো (উল্টো ক্রমে)। টেবিল আগে, তারপর column, শেষে enum।
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.ranking_history;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.ranking_locks;`);
    await queryRunner.query(`
      ALTER TABLE public.student_enrollments
        DROP COLUMN IF EXISTS ranking_locked,
        DROP COLUMN IF EXISTS admission_date;
    `);
    await queryRunner.query(`
      ALTER TABLE public.exams DROP COLUMN IF EXISTS status;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS exam_status_enum;`);
  }
}
