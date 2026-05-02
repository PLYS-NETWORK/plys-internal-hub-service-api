import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `notifications` table for the in-app notification feed.
 *
 * Source of truth for every event the FE shows in the bell drop-down. The live
 * Socket.IO push is fire-and-forget on top — Postgres carries durability so
 * disconnected users catch up via `GET /notifications/me?unread=true` on
 * reconnect. See docs/api-specs/notifications/notifications-realtime-guide.md
 * for the FE contract.
 *
 * Indexes:
 *  - idx_notifications_user_created — backs the cursor list (user_id, created_at DESC)
 *  - idx_notifications_user_unread  — partial index on is_read=false; tiny + hot
 *  - idx_notifications_entity       — admin/debug "show notifications about X"
 */
export class AddNotifications20260502000002 implements MigrationInterface {
  public readonly name = 'AddNotifications20260502000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id"           uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id"      uuid NOT NULL,
        "type"         varchar(40) NOT NULL,
        "title"        varchar(200) NOT NULL,
        "body"         varchar(500) NOT NULL,
        "metadata"     jsonb NOT NULL,
        "entity_type"  varchar(30) NOT NULL,
        "entity_id"    varchar(64) NOT NULL,
        "redirect_url" varchar(1024),
        "actor_id"     uuid,
        "is_read"      boolean NOT NULL DEFAULT false,
        "read_at"      timestamptz,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        "created_by"   uuid,
        CONSTRAINT "pk_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "fk_notifications_to_users"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_notifications_actor_to_users"
          FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notifications_user_created"
        ON "notifications" ("user_id", "created_at" DESC)
    `);

    // Partial index: only rows where is_read = false. Keeps the index small
    // (most production rows trend read) and makes unread-count + unread-only
    // listing scan O(unread_for_user) instead of O(all_for_user).
    await queryRunner.query(`
      CREATE INDEX "idx_notifications_user_unread"
        ON "notifications" ("user_id")
        WHERE "is_read" = false
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_notifications_entity"
        ON "notifications" ("entity_type", "entity_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_unread"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_notifications_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
  }
}
