import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 5 (Support) — notifications টেবিল + leave/notification/dashboard permissions।
 *
 * - notifications: per-recipient row model (recipient_id, is_read সহ)।
 * - permissions: LEAVE_*, NOTIFICATION_*, DASHBOARD_READ যোগ + role grant।
 *   idempotent (ON CONFLICT DO NOTHING) — বিদ্যমান DB-তেও নিরাপদে চলে।
 *
 * Grants:
 *   SUPER_ADMIN(001) → সব
 *   ADMIN(002)       → সব (approve/read-all/delete/notification-send সহ)
 *   TEACHER(003), ACCOUNTANT(005), STAFF(006)
 *                    → self-service (LEAVE_CREATE/READ/UPDATE, NOTIFICATION_READ) + DASHBOARD_READ
 *   STUDENT(004)     → self-service (LEAVE_CREATE/READ/UPDATE, NOTIFICATION_READ)
 */
export class Phase5Support1717000000011 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── notifications টেবিল (per-recipient) ──
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id           uuid NOT NULL DEFAULT gen_random_uuid(),
        recipient_id uuid NOT NULL,
        type         varchar(50)  NOT NULL DEFAULT 'GENERAL',
        title        varchar(150) NOT NULL,
        message      text         NOT NULL,
        is_read      boolean      NOT NULL DEFAULT false,
        read_at      timestamp without time zone,
        related_type varchar(50),
        related_id   uuid,
        created_by   uuid,
        created_at   timestamp without time zone NOT NULL DEFAULT now(),
        updated_at   timestamp without time zone NOT NULL DEFAULT now(),
        deleted_at   timestamp without time zone,
        CONSTRAINT notifications_pkey PRIMARY KEY (id),
        CONSTRAINT notifications_recipient_id_fkey
          FOREIGN KEY (recipient_id) REFERENCES public.users (id) ON DELETE CASCADE,
        CONSTRAINT notifications_created_by_fkey
          FOREIGN KEY (created_by) REFERENCES public.users (id) ON DELETE SET NULL
      );
    `);

    // recipient-এর unread list দ্রুত আনতে
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
        ON public.notifications (recipient_id, is_read)
        WHERE deleted_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at
        ON public.notifications (created_at DESC);
    `);

    // ── permissions ──
    await queryRunner.query(`
      INSERT INTO public.permissions (name) VALUES
        ('LEAVE_CREATE'),
        ('LEAVE_READ'),
        ('LEAVE_READ_ALL'),
        ('LEAVE_UPDATE'),
        ('LEAVE_APPROVE'),
        ('LEAVE_DELETE'),
        ('NOTIFICATION_CREATE'),
        ('NOTIFICATION_READ'),
        ('NOTIFICATION_DELETE'),
        ('DASHBOARD_READ')
      ON CONFLICT DO NOTHING;
    `);

    // SUPER_ADMIN(001) → সব নতুন permission
    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT '00000000-0000-0000-0000-000000000001'::uuid, id
      FROM public.permissions
      WHERE name IN (
        'LEAVE_CREATE','LEAVE_READ','LEAVE_READ_ALL','LEAVE_UPDATE','LEAVE_APPROVE','LEAVE_DELETE',
        'NOTIFICATION_CREATE','NOTIFICATION_READ','NOTIFICATION_DELETE','DASHBOARD_READ'
      )
      ON CONFLICT DO NOTHING;
    `);

    // ADMIN(002) → সব নতুন permission
    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT '00000000-0000-0000-0000-000000000002'::uuid, id
      FROM public.permissions
      WHERE name IN (
        'LEAVE_CREATE','LEAVE_READ','LEAVE_READ_ALL','LEAVE_UPDATE','LEAVE_APPROVE','LEAVE_DELETE',
        'NOTIFICATION_CREATE','NOTIFICATION_READ','NOTIFICATION_DELETE','DASHBOARD_READ'
      )
      ON CONFLICT DO NOTHING;
    `);

    // TEACHER(003), ACCOUNTANT(005), STAFF(006) → self-service + DASHBOARD_READ
    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT r.role_id, p.id
      FROM (VALUES
          ('00000000-0000-0000-0000-000000000003'::uuid),
          ('00000000-0000-0000-0000-000000000005'::uuid),
          ('00000000-0000-0000-0000-000000000006'::uuid)
        ) AS r(role_id)
      CROSS JOIN public.permissions p
      WHERE p.name IN (
        'LEAVE_CREATE','LEAVE_READ','LEAVE_UPDATE','NOTIFICATION_READ','DASHBOARD_READ'
      )
      ON CONFLICT DO NOTHING;
    `);

    // STUDENT(004) → self-service (dashboard ছাড়া)
    await queryRunner.query(`
      INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT '00000000-0000-0000-0000-000000000004'::uuid, id
      FROM public.permissions
      WHERE name IN ('LEAVE_CREATE','LEAVE_READ','LEAVE_UPDATE','NOTIFICATION_READ')
      ON CONFLICT DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM public.role_permissions
      WHERE permission_id IN (
        SELECT id FROM public.permissions
        WHERE name IN (
          'LEAVE_CREATE','LEAVE_READ','LEAVE_READ_ALL','LEAVE_UPDATE','LEAVE_APPROVE','LEAVE_DELETE',
          'NOTIFICATION_CREATE','NOTIFICATION_READ','NOTIFICATION_DELETE','DASHBOARD_READ'
        )
      );
    `);
    await queryRunner.query(`
      DELETE FROM public.permissions
      WHERE name IN (
        'LEAVE_CREATE','LEAVE_READ','LEAVE_READ_ALL','LEAVE_UPDATE','LEAVE_APPROVE','LEAVE_DELETE',
        'NOTIFICATION_CREATE','NOTIFICATION_READ','NOTIFICATION_DELETE','DASHBOARD_READ'
      );
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS public.notifications;`);
  }
}
