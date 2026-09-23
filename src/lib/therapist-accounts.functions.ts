import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Links a catalog card to an existing account so that specialist can confirm
 * their own bookings. Admin-only: verified through the caller's own client.
 */
export const linkTherapistAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ therapistId: z.string().uuid(), email: z.string().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Нужны права администратора");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw new Error("Не удалось прочитать список аккаунтов");
    const account = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!account) throw new Error("Аккаунт с таким email не найден — сначала попросите специалиста зарегистрироваться");

    const { error: updateError } = await supabaseAdmin
      .from("therapists")
      .update({ user_id: account.id })
      .eq("id", data.therapistId);
    if (updateError) throw new Error("Не удалось привязать аккаунт");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: account.id, role: "therapist" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error("Не удалось выдать роль специалиста");

    return { ok: true as const };
  });
