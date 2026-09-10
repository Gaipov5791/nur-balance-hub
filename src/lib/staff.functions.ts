import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEmail, TEMP_ADMIN_EMAILS, TEMP_MEMBER_EMAIL } from "@/lib/staff-accounts";

async function findUserIdByEmail(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  email: string,
): Promise<string | null> {
  const target = normalizeEmail(email);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000, page: 1 });
  if (error) throw new Error("Не удалось найти аккаунты");
  return data.users.find((row) => normalizeEmail(row.email) === target)?.id ?? null;
}

/** Developer + customer are admins; the phone Gmail stays a regular member. */
export const syncAssignedAdmins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const adminIds: string[] = [];
    for (const email of TEMP_ADMIN_EMAILS) {
      const adminId = await findUserIdByEmail(supabaseAdmin, email);
      if (!adminId) continue;
      adminIds.push(adminId);
      const { error } = await supabaseAdmin.from("user_roles").insert({
        user_id: adminId,
        role: "admin",
      });
      if (error && error.code !== "23505") {
        throw new Error("Не удалось выдать роль администратора");
      }
    }

    const memberId = await findUserIdByEmail(supabaseAdmin, TEMP_MEMBER_EMAIL);
    if (memberId) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", memberId)
        .in("role", ["admin", "moderator"]);
      if (error) throw new Error("Не удалось убрать служебную роль у пользовательского аккаунта");
    }

    return { ok: true as const, adminIds, memberId };
  });
