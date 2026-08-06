import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `RANKING_ADMIN` permission যোগ করে — DLQ (parking lot) endpoint গুলোর জন্য:
 *   GET  /ranking/dlq         → ব্যর্থ job peek
 *   POST /ranking/dlq/replay  → DLQ → main queue
 *
 * controller-এ `@Permissions('RANKING_ADMIN')` ছিল, কিন্তু permission সারিটাই
 * কোথাও তৈরি হয়নি (base seed-এ ranking-এর মাত্র ৪টা permission)। SUPER_ADMIN
 * "সব permission" পায় `SELECT id FROM permissions` দিয়ে — টেবিলে না থাকা সারি
 * সেখানেও আসে না, তাই SUPER_ADMIN-ও 403 পাচ্ছিল এবং DLQ feature অচল ছিল।
 *
 * Grants: SUPER_ADMIN(001) মাত্র — DLQ replay job আবার চালায়, তাই সর্বোচ্চ
 * স্তরেই রাখা হলো।
 *
 * idempotent (ON CONFLICT DO NOTHING), তাই বিদ্যমান DB-তেও নিরাপদে চলে।
 */
export class RankingAdminPermission1717000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO public.permissions (name) VALUES
        ('RANKING_ADMIN')
      ON CONFLICT DO NOTHING;
    `);

    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.role_id, p.id
      FROM (VALUES
          ('00000000-0000-0000-0000-000000000001'::uuid, 'RANKING_ADMIN')
        ) AS r(role_id, perm_name)
      JOIN public.permissions p ON p.name = r.perm_name
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id IN (
        SELECT id FROM public.permissions WHERE name = 'RANKING_ADMIN'
      );
    `);
    await queryRunner.query(`
      DELETE FROM public.permissions WHERE name = 'RANKING_ADMIN';
    `);
  }
}
