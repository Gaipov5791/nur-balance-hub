import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tables exported for the user, with the column holding their id.
const OWN_TABLES: [string, string][] = [
  ["profiles", "id"],
  ["journal_entries", "user_id"],
  ["mood_checkins", "user_id"],
  ["custom_tags", "user_id"],
  ["ai_analyses", "user_id"],
  ["ai_chat_messages", "user_id"],
  ["coin_transactions", "user_id"],
  ["subscriptions", "user_id"],
  ["payment_orders", "user_id"],
  ["therapist_requests", "user_id"],
  ["app_feedback", "user_id"],
  ["notifications", "user_id"],
];

// Rows removed on account deletion (payment_orders kept for accounting, unlinked by user deletion).
const DELETE_TABLES: [string, string][] = [
  ["journal_entries", "user_id"],
  ["mood_checkins", "user_id"],
  ["custom_tags", "user_id"],
  ["ai_analyses", "user_id"],
  ["ai_chat_messages", "user_id"],
  ["ai_usage", "user_id"],
  ["coin_transactions", "user_id"],
  ["subscriptions", "user_id"],
  ["therapist_requests", "user_id"],
  ["app_feedback", "user_id"],
  ["notifications", "user_id"],
  ["buddy_queue", "user_id"],
  ["buddy_blocks", "user_id"],
  ["reward_redemptions", "user_id"],
];

/** Returns all of the caller's own data as JSON (read under RLS). */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), user_id: context.userId };
    for (const [table, col] of OWN_TABLES) {
      const { data } = await (context.supabase as any).from(table).select("*").eq(col, context.userId);
      out[table] = data ?? [];
    }
    return JSON.stringify(out, null, 2);
  });

/** Permanently deletes the caller's account, files and personal records. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("УДАЛИТЬ") }).parse(d))
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    for (const bucket of ["journal-videos", "buddy-media"]) {
      for (let i = 0; i < 50; i++) {
        const { data } = await admin.storage.from(bucket).list(uid, { limit: 100 });
        if (!data?.length) break;
        await admin.storage.from(bucket).remove(data.map((f: { name: string }) => `${uid}/${f.name}`));
      }
    }
    for (const [table, col] of DELETE_TABLES) {
      await admin.from(table).delete().eq(col, uid);
    }
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Не получилось удалить аккаунт, попробуй позже");
    return { ok: true };
  });
