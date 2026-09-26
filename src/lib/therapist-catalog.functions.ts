import { createServerFn } from "@tanstack/react-start";
import { DARYA_TAKMAKOVA } from "@/data/therapist-catalog";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Upserts catalog cards that live in code. Lovable does not apply GitHub SQL
 * data migrations automatically, so the public list would stay empty of new
 * specialists until this runs with the service role.
 */
export const ensureTherapistCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: byName, error: nameError } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("name", DARYA_TAKMAKOVA.name)
      .limit(1);
    if (nameError) throw new Error("Не удалось проверить каталог психологов");

    if (!byName?.length) {
      const { data: last } = await supabaseAdmin
        .from("therapists")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error: insertError } = await supabaseAdmin.from("therapists").insert({
        ...DARYA_TAKMAKOVA,
        sort_order: (last?.sort_order ?? 0) + 10,
      });
      if (insertError) throw new Error("Не удалось добавить карточку специалиста");
    }

    return { ok: true as const };
  });
