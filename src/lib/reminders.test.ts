import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_TIME,
  isInReminderWindow,
  localDateInZone,
  normalizeReminderTime,
  shouldSendReminder,
} from "@/lib/reminders";

const almatyNinePm = new Date("2026-09-13T16:05:00.000Z");

function candidate(
  overrides: Partial<Parameters<typeof shouldSendReminder>[0]> = {},
): Parameters<typeof shouldSendReminder>[0] {
  return {
    reminder_enabled: true,
    reminder_time: "21:00",
    reminder_timezone: "Asia/Almaty",
    last_entry_date: null,
    last_reminder_sent_on: null,
    ...overrides,
  };
}

describe("normalizeReminderTime", () => {
  it("keeps valid HH:MM and trims seconds", () => {
    expect(normalizeReminderTime("21:00:00")).toBe("21:00");
    expect(normalizeReminderTime("9:05")).toBe("09:05");
  });

  it("falls back to the default evening time", () => {
    expect(normalizeReminderTime("")).toBe(DEFAULT_REMINDER_TIME);
    expect(normalizeReminderTime("25:00")).toBe(DEFAULT_REMINDER_TIME);
  });
});

describe("isInReminderWindow", () => {
  it("is true inside the 15-minute local window", () => {
    expect(isInReminderWindow(almatyNinePm, "21:00", "Asia/Almaty")).toBe(true);
    expect(isInReminderWindow(new Date("2026-09-13T15:50:00.000Z"), "21:00", "Asia/Almaty")).toBe(
      false,
    );
    expect(isInReminderWindow(new Date("2026-09-13T16:20:00.000Z"), "21:00", "Asia/Almaty")).toBe(
      false,
    );
  });

  it("wraps around midnight", () => {
    expect(isInReminderWindow(new Date("2026-09-13T18:58:00.000Z"), "23:55", "Asia/Almaty")).toBe(
      true,
    );
    expect(isInReminderWindow(new Date("2026-09-13T19:05:00.000Z"), "23:55", "Asia/Almaty")).toBe(
      true,
    );
  });
});

describe("shouldSendReminder", () => {
  it("sends when the local time matches and there is no entry today", () => {
    expect(shouldSendReminder(candidate(), almatyNinePm)).toBe(true);
    expect(localDateInZone(almatyNinePm, "Asia/Almaty")).toBe("2026-09-13");
  });

  it("skips when a journal entry already exists for the local day", () => {
    expect(shouldSendReminder(candidate({ last_entry_date: "2026-09-13" }), almatyNinePm)).toBe(
      false,
    );
  });

  it("skips when a reminder already went out today", () => {
    expect(
      shouldSendReminder(candidate({ last_reminder_sent_on: "2026-09-13" }), almatyNinePm),
    ).toBe(false);
  });

  it("skips when reminders are disabled or the window has not started", () => {
    expect(shouldSendReminder(candidate({ reminder_enabled: false }), almatyNinePm)).toBe(false);
    expect(
      shouldSendReminder(candidate(), new Date("2026-09-13T15:00:00.000Z")),
    ).toBe(false);
  });
});
