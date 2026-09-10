import { describe, expect, it } from "vitest";
import { extractInstagram, extractPhone, priceParts, specItems, toTelHref } from "./therapists";

describe("therapist catalog helpers", () => {
  it("splits specializations and dual prices", () => {
    expect(specItems("Травма, личные границы, самооценка").length).toBe(3);
    expect(priceParts("онлайн 10 000 ₸ · офлайн 13 000 ₸")).toEqual([
      "онлайн 10 000 ₸",
      "офлайн 13 000 ₸",
    ]);
  });

  it("extracts phone and instagram from bio", () => {
    expect(extractPhone("Для записи: +7 776 270 82 44")).toBe("+7 776 270 82 44");
    expect(toTelHref("8 7762708244")).toBe("+77762708244");
    expect(extractInstagram("Instagram: @aliya.psiholog\nНомер: +7 707 111 60 20")).toBe(
      "aliya.psiholog",
    );
  });
});
