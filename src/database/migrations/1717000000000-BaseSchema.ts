import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 000 schema.sql — Student Management System-এর base schema।
 *
 * সব core টেবিল + gender_enum/exam_type_enum + pgcrypto extension।
 * এটাই প্রথম migration (সবচেয়ে ছোট timestamp) — বাকি সব এর উপর নির্ভরশীল।
 *
 * NOTE: exams.status, student_enrollments.admission_date/ranking_locked/enrollment_type
 * এখানে নেই — সেগুলো পরের migration (001/002) যোগ করে।
 */
export class BaseSchema1717000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // ── Enums ──
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE gender_enum AS ENUM ('MALE', 'FEMALE', 'OTHER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE exam_type_enum AS ENUM ('ADMISSION', 'MIDTERM', 'FINAL', 'UNIT_TEST');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // ── Permissions ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.permissions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(100) NOT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT permissions_pkey PRIMARY KEY (id),
        CONSTRAINT permissions_name_key UNIQUE (name)
      );
    `);

    // ── Roles ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.roles (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(50) NOT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT roles_pkey PRIMARY KEY (id),
        CONSTRAINT roles_name_key UNIQUE (name)
      );
    `);

    // ── Role <-> Permissions ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.role_permissions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
        CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id),
        CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES permissions (id),
        CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id)
      );
    `);

    // ── Users ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        full_name character varying(100) NOT NULL,
        email character varying(100) NOT NULL,
        password text NOT NULL,
        role_id uuid,
        is_active boolean DEFAULT true,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        gender gender_enum DEFAULT 'MALE',
        CONSTRAINT users_pkey PRIMARY KEY (id),
        CONSTRAINT users_email_key UNIQUE (email),
        CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles (id)
      );
    `);

    // ── Academic Sessions ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.academic_sessions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(50) NOT NULL,
        start_date date,
        end_date date,
        is_active boolean DEFAULT false,
        admission_test_enabled boolean DEFAULT true,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT academic_sessions_pkey PRIMARY KEY (id)
      );
    `);

    // ── Classes ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.classes (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(50) NOT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT classes_pkey PRIMARY KEY (id)
      );
    `);

    // ── Sections ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.sections (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        class_id uuid,
        name character varying(20) NOT NULL,
        max_capacity integer DEFAULT NULL,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT sections_pkey PRIMARY KEY (id),
        CONSTRAINT sections_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id)
      );
    `);

    // ── Subjects ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.subjects (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(100) NOT NULL,
        code character varying(20),
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT subjects_pkey PRIMARY KEY (id),
        CONSTRAINT subjects_code_key UNIQUE (code)
      );
    `);

    // ── Teachers ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.teachers (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid,
        phone character varying(20),
        designation character varying(100),
        qualification text,
        joining_date date,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT teachers_pkey PRIMARY KEY (id),
        CONSTRAINT teachers_user_id_key UNIQUE (user_id),
        CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // ── Students ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.students (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        student_code character varying(30) NOT NULL,
        date_of_birth date,
        guardian_name character varying(100),
        guardian_phone character varying(20),
        address text,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        user_id uuid,
        CONSTRAINT students_pkey PRIMARY KEY (id),
        CONSTRAINT students_student_code_key UNIQUE (student_code),
        CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // ── Subject Assignments ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.subject_assignments (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        teacher_id uuid,
        class_id uuid,
        section_id uuid,
        subject_id uuid,
        academic_session_id uuid,
        assigned_by uuid,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT subject_assignments_pkey PRIMARY KEY (id),
        CONSTRAINT subject_assignments_teacher_id_class_id_section_id_subject__key
          UNIQUE (teacher_id, class_id, section_id, subject_id, academic_session_id),
        CONSTRAINT subject_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id),
        CONSTRAINT subject_assignments_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections (id),
        CONSTRAINT subject_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects (id),
        CONSTRAINT subject_assignments_academic_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES academic_sessions (id),
        CONSTRAINT subject_assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers (id),
        CONSTRAINT subject_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users (id)
      );
    `);

    // ── Student Enrollments ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.student_enrollments (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        student_id uuid,
        class_id uuid,
        section_id uuid,
        academic_session_id uuid,
        roll_number integer,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT student_enrollments_pkey PRIMARY KEY (id),
        CONSTRAINT student_enrollments_student_id_academic_session_id_key UNIQUE (student_id, academic_session_id),
        CONSTRAINT student_enrollments_academic_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES academic_sessions (id),
        CONSTRAINT student_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id),
        CONSTRAINT student_enrollments_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections (id),
        CONSTRAINT student_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id)
      );
    `);

    // ── Exams ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.exams (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        name character varying(100) NOT NULL,
        class_id uuid,
        academic_session_id uuid,
        exam_date date,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        exam_type exam_type_enum NOT NULL DEFAULT 'ADMISSION',
        CONSTRAINT exams_pkey PRIMARY KEY (id),
        CONSTRAINT exams_academic_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES academic_sessions (id),
        CONSTRAINT exams_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id)
      );
    `);

    // ── Exam Results ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.exam_results (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        exam_id uuid,
        student_id uuid,
        subject_id uuid,
        marks numeric(5, 2),
        grade character varying(5),
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT exam_results_pkey PRIMARY KEY (id),
        CONSTRAINT exam_results_exam_id_student_id_subject_id_key UNIQUE (exam_id, student_id, subject_id),
        CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES exams (id),
        CONSTRAINT exam_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id),
        CONSTRAINT exam_results_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects (id)
      );
    `);

    // ── Student Attendance ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.student_attendance (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        student_id uuid,
        class_id uuid,
        section_id uuid,
        attendance_date date,
        status character varying(20),
        created_at timestamp without time zone DEFAULT now(),
        updated_at timestamp without time zone DEFAULT now(),
        deleted_at timestamp without time zone,
        CONSTRAINT student_attendance_pkey PRIMARY KEY (id),
        CONSTRAINT student_attendance_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes (id),
        CONSTRAINT student_attendance_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections (id),
        CONSTRAINT student_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students (id),
        CONSTRAINT chk_student_attendance_status CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED'))
      );
    `);

    // ── Staff Attendance Logs ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.attendance_logs (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        attendance_date date NOT NULL,
        check_in timestamp without time zone,
        check_out timestamp without time zone,
        total_work_minutes integer DEFAULT 0,
        status character varying(20) DEFAULT 'PRESENT',
        notes text,
        created_at timestamp without time zone DEFAULT now(),
        updated_at timestamp without time zone DEFAULT now(),
        deleted_at timestamp without time zone,
        ip_address text,
        check_in_latitude numeric,
        check_in_longitude numeric,
        check_out_latitude numeric,
        check_out_longitude numeric,
        CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
        CONSTRAINT attendance_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // ── Leaves ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.leaves (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid,
        leave_type character varying(50),
        start_date date,
        end_date date,
        reason text,
        status character varying(20) DEFAULT 'PENDING',
        created_at timestamp without time zone DEFAULT now(),
        updated_at timestamp without time zone DEFAULT now(),
        deleted_at timestamp without time zone,
        CONSTRAINT leaves_pkey PRIMARY KEY (id),
        CONSTRAINT leaves_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);

    // ── Fee Structures ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.fee_structures (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        class_id uuid,
        academic_session_id uuid,
        amount numeric(10, 2) NOT NULL,
        due_date date,
        description text,
        created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
        deleted_at timestamp without time zone,
        CONSTRAINT fee_structures_pkey PRIMARY KEY (id),
        -- description যোগ করা হয়েছে যাতে একই class+session-এ একাধিক fee
        -- (First/Second Semester) থাকতে পারে
        CONSTRAINT fee_structures_class_id_academic_session_id_key UNIQUE (class_id, academic_session_id, description),
        CONSTRAINT chk_fee_structures_amount CHECK (amount >= 0),
        CONSTRAINT fee_structures_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes (id),
        CONSTRAINT fee_structures_academic_session_id_fkey FOREIGN KEY (academic_session_id) REFERENCES public.academic_sessions (id)
      );
    `);
  }

  // down() — FK নির্ভরতার উল্টো ক্রমে drop; শেষে enum।
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.fee_structures;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.leaves;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.attendance_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.student_attendance;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.exam_results;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.exams;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.student_enrollments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.subject_assignments;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.students;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.teachers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.subjects;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.sections;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.classes;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.academic_sessions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.role_permissions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.roles;`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.permissions;`);
    await queryRunner.query(`DROP TYPE IF EXISTS exam_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS gender_enum;`);
  }
}
