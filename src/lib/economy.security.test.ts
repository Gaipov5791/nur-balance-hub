import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(
  join(root, "supabase/migrations/20260910120000_economy_pin_hardening.sql"),
  "utf8",
);

describe("economy SQL hardening", () => {
  it("blocks client inserts into the coin ledger and redemptions", () => {
    expect(sql).toContain('DROP POLICY IF EXISTS "Users add own coin transactions"');
    expect(sql).toContain("REVOKE INSERT ON public.coin_transactions FROM authenticated");
    expect(sql).toContain('DROP POLICY IF EXISTS "Users can create their own redemptions"');
    expect(sql).toContain("REVOKE INSERT ON public.reward_redemptions FROM authenticated");
  });

  it("locks profile coins/streak/PIN behind definer functions", () => {
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS coin_transactions_user_action_key");
    expect(sql).toContain("protect_profile_economy");
    expect(sql).toContain("app.allow_economy");
    expect(sql).toContain("app.allow_pin");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("ON CONFLICT (user_id, action) DO NOTHING");
  });

  it("exposes only the public RPCs to authenticated users", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.save_journal_entry");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.award_action(text)");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.redeem_catalog_reward(text)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public._economy_insert");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.has_journal_pin()");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.verify_journal_pin(text)");
  });
});
