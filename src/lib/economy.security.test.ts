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

const stageB = readFileSync(join(root, "drizzle/migrations/0002_ai_analyzer_coins.sql"), "utf8");

describe("refill and AI analysis SQL", () => {
  it("removes the old earning and reward RPCs", () => {
    expect(stageB).toContain("DROP FUNCTION IF EXISTS public.award_action(text)");
    expect(stageB).toContain("DROP FUNCTION IF EXISTS public.redeem_catalog_reward(text)");
    expect(stageB).not.toMatch(/_economy_insert\(.*'journal_daily/);
  });

  it("guards the refill anchor like the balance", () => {
    expect(stageB).toContain("NEW.coins_refilled_at IS DISTINCT FROM OLD.coins_refilled_at");
    expect(stageB).toMatch(/claim_coin_refill[\s\S]*FOR UPDATE[\s\S]*259200/);
  });

  it("keeps analyses and subscriptions read-only for clients", () => {
    expect(stageB).toContain("GRANT SELECT ON public.ai_analyses TO authenticated;");
    expect(stageB).toContain("GRANT SELECT ON public.subscriptions TO authenticated;");
    expect(stageB).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*ON public\.(ai_analyses|subscriptions) TO authenticated/,
    );
  });

  it("charges atomically and only refunds pending runs once", () => {
    expect(stageB).toMatch(/start_ai_analysis[\s\S]*FOR UPDATE[\s\S]*'insufficient'/);
    expect(stageB).toMatch(/_analysis_refund[\s\S]*status = 'pending'[\s\S]*RETURNING cost/);
  });

  it("does not expose internal helpers", () => {
    for (const fn of [
      "has_active_subscription(uuid)",
      "_analysis_free_used(uuid, date)",
      "_analysis_refund(uuid, uuid)",
    ]) {
      expect(stageB).toContain(
        `REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`,
      );
      expect(stageB).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
  });
});

const stageC = readFileSync(join(root, "drizzle/migrations/0003_demo_payments.sql"), "utf8");

describe("demo payments SQL", () => {
  it("keeps payments read-only for clients", () => {
    expect(stageC).toContain("GRANT SELECT ON public.payments TO authenticated;");
    expect(stageC).not.toMatch(
      /GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*ON public\.payments TO authenticated/,
    );
  });

  it("prices products on the server", () => {
    expect(stageC).toMatch(
      /create_payment[\s\S]*price := 1890;[\s\S]*pack := 230;[\s\S]*price := 2150;/,
    );
  });

  it("fulfills a payment once, under locks", () => {
    expect(stageC).toMatch(
      /_fulfill_payment[\s\S]*FOR UPDATE[\s\S]*status <> 'pending'[\s\S]*FOR UPDATE/,
    );
  });

  it("confirms only the caller's own demo payments", () => {
    expect(stageC).toMatch(/confirm_demo_payment[\s\S]*p\.user_id <> me OR p\.provider <> 'demo'/);
    expect(stageC).toMatch(/confirm_demo_payment[\s\S]*_payment_block_reason/);
  });

  it("raises the NurAI limit only through ai_daily_limit", () => {
    expect(stageC).toContain(
      "CASE WHEN public.has_active_subscription(_user_id) THEN 100 ELSE 30 END",
    );
  });

  it("does not expose internal helpers", () => {
    for (const fn of [
      "ai_daily_limit(uuid)",
      "_payment_block_reason(uuid, text)",
      "_fulfill_payment(uuid)",
    ]) {
      expect(stageC).toContain(
        `REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`,
      );
      expect(stageC).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
  });
});
