import { describe, expect, it } from "vitest";
import { renderJournalReminderHtml, renderJournalReminderText } from "@/lib/reminder-email";
import { REMINDER_BODY, REMINDER_SUBJECT } from "@/lib/reminders";

describe("journal reminder email", () => {
  it("keeps the soft diary prompt and settings opt-out", () => {
    const text = renderJournalReminderText({
      name: "Алия",
      journalUrl: "https://example.test/journal",
      settingsUrl: "https://example.test/settings",
    });
    expect(text).toContain("Алия, как прошёл день?");
    expect(text).toContain(REMINDER_BODY);
    expect(text).toContain("https://example.test/journal");
    expect(text).toContain("https://example.test/settings");

    const html = renderJournalReminderHtml({
      name: "Алия",
      journalUrl: "https://example.test/journal",
      settingsUrl: "https://example.test/settings",
    });
    expect(html).toContain(REMINDER_SUBJECT);
    expect(html).toContain("{{ unsubscribe_url }}");
    expect(html).toContain("background:#ffffff");
  });
});
