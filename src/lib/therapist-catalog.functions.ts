import { createServerFn } from "@tanstack/react-start";
import { ALIYA_CONTACTS, DARYA_TAKMAKOVA } from "@/data/therapist-catalog";
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

    const { data: byEmail, error: emailError } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("contact_email", DARYA_TAKMAKOVA.contact_email)
      .limit(1);
    if (emailError) throw new Error("Не удалось проверить каталог психологов");

    const { data: byName, error: nameError } = byEmail?.length
      ? { data: byEmail, error: null }
      : await supabaseAdmin
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

    const { data: aliyas, error: aliyaError } = await supabaseAdmin
      .from("therapists")
      .select("id, bio")
      .ilike("name", "%Алия%");
    if (aliyaError) throw new Error("Не удалось обновить контакты специалиста");

    const suffix = `\n\nInstagram: ${ALIYA_CONTACTS.instagram}\nНомер: ${ALIYA_CONTACTS.phone}`;
    for (const row of aliyas ?? []) {
      if (row.bio.toLowerCase().includes("aliya.psiholog")) continue;
      const { error: updateError } = await supabaseAdmin
        .from("therapists")
        .update({ bio: `${row.bio.trim()}${suffix}` })
        .eq("id", row.id);
      if (updateError) throw new Error("Не удалось обновить контакты специалиста");
    }

    return { ok: true as const };
  });
