import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * attendance module-এর permission গুলো যোগ করে — ATTENDANCE_MARK ও ATTENDANCE_READ।
 *
 * base seed-এ attendance permission বাদ ছিল (তখন module ছিল না)। এখন module
 * আসায় permission + role grant দরকার। idempotent (ON CONFLICT DO NOTHING),
 * তাই বিদ্যমান DB-তেও নিরাপদে চলে।
 *
 * Grants:
 *   SUPER_ADMIN(001), ADMIN(002)     → MARK + READ
 *   TEACHER(003)                     → MARK + READ (student attendance নেয়)
 *   STAFF(006)                       → MARK + READ (নিজের check-in/out)
 */
export class AttendancePermissions1717000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.permissions (name) VALUES
        ('ATTENDANCE_MARK'),
        ('ATTENDANCE_READ')
      ON CONFLICT DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.role_id, p.id
      FROM (VALUES
          ('00000000-0000-0000-0000-000000000001'::uuid, 'ATTENDANCE_MARK'),
          ('00000000-0000-0000-0000-000000000001'::uuid, 'ATTENDANCE_READ'),
          ('00000000-0000-0000-0000-000000000002'::uuid, 'ATTENDANCE_MARK'),
          ('00000000-0000-0000-0000-000000000002'::uuid, 'ATTENDANCE_READ'),
          ('00000000-0000-0000-0000-000000000003'::uuid, 'ATTENDANCE_MARK'),
          ('00000000-0000-0000-0000-000000000003'::uuid, 'ATTENDANCE_READ'),
          ('00000000-0000-0000-0000-000000000006'::uuid, 'ATTENDANCE_MARK'),
          ('00000000-0000-0000-0000-000000000006'::uuid, 'ATTENDANCE_READ')
        ) AS r(role_id, perm_name)
      JOIN public.permissions p ON p.name = r.perm_name
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // grant গুলো role_permissions থেকে সরাও, তারপর permission মুছে দাও
    await queryRunner.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id IN (
        SELECT id FROM public.permissions
        WHERE name IN ('ATTENDANCE_MARK', 'ATTENDANCE_READ')
      );
    `);
    await queryRunner.query(`
      DELETE FROM public.permissions
      WHERE name IN ('ATTENDANCE_MARK', 'ATTENDANCE_READ');
    `);
  }
}