import { describe, expect, it } from "vitest";
import { buildAnalyzerInput } from "@/lib/analysis-input";

describe("analyzer input", () => {
  it("includes speech transcripts of audio/video journal entries", () => {
    const text = buildAnalyzerInput({
      periodLabel: "неделя",
      start: "2026-10-25",
      end: "2026-10-31",
      checkins: [],
      journal: [{ entry_date: "2026-10-30", mood: "tired", level: 3, note: "", transcript: "Сегодня устал, но прогулка помогла" }],
    });
    expect(text).toContain("Сегодня устал, но прогулка помогла");
  });
});
