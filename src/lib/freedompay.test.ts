import { describe, expect, it } from "vitest";
import { fpSignString, xmlValue } from "./freedompay";

describe("freedompay helpers", () => {
  it("decodes &amp; in the payment page link", () => {
    const xml = "<response><pg_redirect_url>https://customer.freedompay.kz/pay.html?customer=abc&amp;lang=ru</pg_redirect_url></response>";
    expect(xmlValue(xml, "pg_redirect_url")).toBe("https://customer.freedompay.kz/pay.html?customer=abc&lang=ru");
  });

  it("signs sorted values without pg_sig", () => {
    expect(fpSignString("freedompay", { pg_b: "2", pg_a: "1", pg_sig: "x" }, "s")).toBe("freedompay;1;2;s");
  });
});
