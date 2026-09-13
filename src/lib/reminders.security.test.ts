import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sql = readFileSync(join(root, "supabase/migrations/20260913120000_journal_reminders.sql"), "utf8");

describe("journal reminder SQL", () => {
  it("stores reminder prefs on profiles and stamps sends server-side", () => {
    expect(sql).toContain("reminder_enabled");
    expect(sql).toContain("reminder_time");
    expect(sql).toContain("reminder_timezone");
    expect(sql).toContain("last_reminder_sent_on");
    expect(sql).toContain("protect_profile_reminder_stamp");
    expect(sql).toContain("app.allow_reminder_send");
    expect(sql).toContain("claim_journal_reminder");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.claim_journal_reminder(uuid, date) TO service_role");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.claim_journal_reminder(uuid, date) FROM anon, authenticated");
  });
});
