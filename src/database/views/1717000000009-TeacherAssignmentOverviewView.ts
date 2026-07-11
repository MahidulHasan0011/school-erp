import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * views/teacher_assignment_overview.sql — "কোন teacher কোন class/section/subject পড়ান"।
 *
 * subject_assignments-এ শুধু UUID থাকে; এই view সব নাম resolve করে দেয়।
 * base টেবিলের উপর নির্ভরশীল, তাই BaseSchema-এর পরে চলে।
 */
export class TeacherAssignmentOverviewView1717000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.teacher_assignment_overview AS
      SELECT
        sa.id                    AS assignment_id,
        sa.teacher_id,
        u.full_name              AS teacher_name,
        t.designation,
        sa.class_id,
        c.name                   AS class_name,
        sa.section_id,
        sec.name                 AS section_name,
        sa.subject_id,
        sub.name                 AS subject_name,
        sub.code                 AS subject_code,
        sa.academic_session_id,
        asess.name               AS session_name,
        asess.is_active          AS session_is_active,
        sa.created_at
      FROM public.subject_assignments sa
      JOIN public.teachers t ON t.id = sa.teacher_id
      JOIN public.users u ON u.id = t.user_id
      JOIN public.classes c ON c.id = sa.class_id
      LEFT JOIN public.sections sec ON sec.id = sa.section_id
      JOIN public.subjects sub ON sub.id = sa.subject_id
      JOIN public.academic_sessions asess ON asess.id = sa.academic_session_id
      WHERE sa.deleted_at IS NULL
        AND t.deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS public.teacher_assignment_overview;`);
  }
}
