import { describe, expect, it } from "vitest";
import { buildTelegramMessage, formatAstana, formatAstanaTime, type RequestInfo } from "@/lib/telegram";

const scheduled: RequestInfo = {
  client_name: "Асель",
  preferred_time: "",
  topic: "Тревога",
  status: "scheduled",
  duration_minutes: 50,
  scheduled_at: "2026-10-28T10:00:00.000Z",
};

describe("Astana time", () => {
  it("shows consultation time in UTC+5", () => {
    expect(formatAstanaTime("2026-10-28T10:00:00.000Z")).toBe("15:00");
    expect(formatAstana("2026-10-28T21:30:00.000Z")).toBe("29 октября, 02:30");
  });
});

describe("reminders", () => {
  it("are not sent for a cancelled consultation", () => {
    expect(buildTelegramMessage("reminder_24h", { ...scheduled, status: "cancelled" })).toBeNull();
    expect(buildTelegramMessage("reminder_1h", { ...scheduled, status: "cancelled" })).toBeNull();
  });

  it("1-hour reminder links to the client chat when it exists", () => {
    const url = "https://nur-balance-hub.lovable.app/therapy-chat?chat=abc";
    expect(buildTelegramMessage("reminder_1h", scheduled, {}, url)?.button?.url).toBe(url);
  });
});

describe("client text", () => {
  it("escapes HTML in client-entered fields", () => {
    const msg = buildTelegramMessage("new_request", { ...scheduled, client_name: "<b>x</b>" });
    expect(msg?.text).not.toContain("<b>x</b>");
  });
});
