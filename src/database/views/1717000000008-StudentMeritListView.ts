import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * views/student_merit_list.sql — class + session ভিত্তিক merit list।
 *
 * PUBLISHED UNIT_TEST+MIDTERM+FINAL exam-এর marks যোগ করে, ৫ ধাপের tie-breaking
 * rule অনুযায়ী rank দেয়। roll.engine এই rank_position দিয়ে roll_number assign করে।
 *
 * ⚠️ নির্ভরশীলতা: exams.status ('PUBLISHED') আর student_enrollments.admission_date
 * — দুটোই RollRankSystem (001) migration যোগ করে। তাই এটা 001-এর পরে চলতে হবে
 * (timestamp 008 > 001, তাই order ঠিক আছে)।
 */
export class StudentMeritListView1717000000008 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE VIEW public.student_merit_list AS
      WITH per_exam_totals AS (
        SELECT
          er.student_id,
          e.id          AS exam_id,
          e.exam_type,
          e.class_id,
          e.academic_session_id,
          SUM(er.marks) AS exam_total
        FROM public.exam_results er
        JOIN public.exams e ON e.id = er.exam_id
        WHERE er.deleted_at IS NULL
          AND e.deleted_at IS NULL
          AND e.status = 'PUBLISHED'
          AND e.exam_type IN ('UNIT_TEST', 'MIDTERM', 'FINAL')
        GROUP BY er.student_id, e.id, e.exam_type, e.class_id, e.academic_session_id
      )
      SELECT
        pet.class_id,
        pet.academic_session_id,
        pet.student_id,
        s.student_code,
        u.full_name                      AS student_name,
        se.admission_date,
        se.created_at                    AS enrollment_created_at,

        SUM(pet.exam_total)              AS total_score,

        COALESCE(SUM(pet.exam_total) FILTER (WHERE pet.exam_type = 'FINAL'), 0)   AS FINAL_score,
        COALESCE(SUM(pet.exam_total) FILTER (WHERE pet.exam_type = 'MIDTERM'), 0) AS midterm_score,

        RANK() OVER (
          PARTITION BY pet.class_id, pet.academic_session_id
          ORDER BY
            SUM(pet.exam_total) DESC,
            COALESCE(SUM(pet.exam_total) FILTER (WHERE pet.exam_type = 'FINAL'), 0) DESC,
            COALESCE(SUM(pet.exam_total) FILTER (WHERE pet.exam_type = 'MIDTERM'), 0) DESC,
            se.admission_date ASC,
            se.created_at ASC,
            pet.student_id ASC
        ) AS rank_position

      FROM per_exam_totals pet
      JOIN public.students s ON s.id = pet.student_id
      JOIN public.users u ON u.id = s.user_id
      JOIN public.student_enrollments se
        ON se.student_id = pet.student_id
        AND se.academic_session_id = pet.academic_session_id
        AND se.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      GROUP BY pet.class_id, pet.academic_session_id, pet.student_id,
               s.student_code, u.full_name, se.admission_date, se.created_at;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW IF EXISTS public.student_merit_list;`);
  }
}
