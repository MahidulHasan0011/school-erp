import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 002_student_enrole.sql — student_enrollments-এ enrollment_type column।
 *
 * OLD = আগে থেকেই ভর্তি, NEW = নতুন ভর্তি (ranking/FIFO logic-এ কাজে লাগে)।
 * ALTER আগের টেবিলের উপর নির্ভরশীল, তাই BaseSchema-এর পরে চলবে।
 */
export class StudentEnrollType1717000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE enrollment_type_enum AS ENUM ('OLD', 'NEW');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE public.student_enrollments
        ADD COLUMN IF NOT EXISTS enrollment_type enrollment_type_enum NOT NULL DEFAULT 'OLD';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.student_enrollments DROP COLUMN IF EXISTS enrollment_type;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS enrollment_type_enum;`);
  }
}
