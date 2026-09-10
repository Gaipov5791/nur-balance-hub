import { describe, expect, it } from "vitest";
import {
  assertNearbyEntryDate,
  assertOwnedStoragePath,
  isAllowedJournalDuration,
} from "@/lib/journal-guards";

describe("assertOwnedStoragePath", () => {
  it("accepts the owner folder and a missing thumbnail", () => {
    expect(() => assertOwnedStoragePath("user-1", "user-1/clip.webm")).not.toThrow();
    expect(() => assertOwnedStoragePath("user-1", null)).not.toThrow();
  });

  it("rejects a foreign path", () => {
    expect(() => assertOwnedStoragePath("user-1", "user-2/clip.webm")).toThrow("Недопустимый путь файла");
    expect(() => assertOwnedStoragePath("user-1", "user-1")).toThrow("Недопустимый путь файла");
  });
});

describe("assertNearbyEntryDate", () => {
  it("allows today and one day around the server date", () => {
    expect(() => assertNearbyEntryDate("2026-09-10", "2026-09-10")).not.toThrow();
    expect(() => assertNearbyEntryDate("2026-09-09", "2026-09-10")).not.toThrow();
    expect(() => assertNearbyEntryDate("2026-09-11", "2026-09-10")).not.toThrow();
  });

  it("rejects dates further than one day", () => {
    expect(() => assertNearbyEntryDate("2026-09-08", "2026-09-10")).toThrow("Некорректная дата записи");
  });
});

describe("isAllowedJournalDuration", () => {
  it("accepts 1..185 seconds", () => {
    expect(isAllowedJournalDuration(1)).toBe(true);
    expect(isAllowedJournalDuration(180)).toBe(true);
    expect(isAllowedJournalDuration(185)).toBe(true);
    expect(isAllowedJournalDuration(0)).toBe(false);
    expect(isAllowedJournalDuration(186)).toBe(false);
  });
});
