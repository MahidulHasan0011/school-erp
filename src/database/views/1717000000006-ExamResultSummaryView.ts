import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * views/exam_result_summary.sql — result card / মার্কশিট view।
 *
 * exam_results-এ শুধু ID থাকে; এই view student/subject/exam নাম join করে দেয়।
 * base টেবিলের উপর নির্ভরশীল, তাই BaseSchema-এর পরে চলে।
 */
export class ExamResultSummaryView1717000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.exam_result_summary AS
      SELECT
        er.id                   AS result_id,
        er.exam_id,
        e.name                  AS exam_name,
        e.exam_type,
        e.exam_date,
        e.academic_session_id,
        er.student_id,
        s.student_code,
        u.full_name             AS student_name,
        er.subject_id,
        sub.name                AS subject_name,
        sub.code                AS subject_code,
        er.marks,
        er.grade,
        er.created_at
      FROM public.exam_results er
      JOIN public.exams e ON e.id = er.exam_id
      JOIN public.students s ON s.id = er.student_id
      JOIN public.users u ON u.id = s.user_id
      JOIN public.subjects sub ON sub.id = er.subject_id
      WHERE er.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND s.deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS public.exam_result_summary;`);
  }
}
