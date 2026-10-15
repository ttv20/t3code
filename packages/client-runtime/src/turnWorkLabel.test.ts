import { describe, expect, it } from "vite-plus/test";
import { formatTurnWorkLabel } from "./turnWorkLabel.ts";

describe("settled work labels", () => {
  it("translates completed and interrupted work with localized seconds", () => {
    expect(formatTurnWorkLabel(22_000, false, "he")).toBe("עבד במשך 22 שניות");
    expect(formatTurnWorkLabel(22_000, true, "he")).toBe("הפסקת אחרי 22 שניות");
  });

  it("keeps English duration formatting", () => {
    expect(formatTurnWorkLabel(2_000, false)).toBe("Worked for 2.0s");
    expect(formatTurnWorkLabel(4_077_000, false)).toBe("Worked for 1h 7m 57s");
    expect(formatTurnWorkLabel(12_000, true)).toBe("You stopped after 12s");
  });

  it("localizes hours, minutes and seconds with a localized conjunction", () => {
    const label = formatTurnWorkLabel(4_077_000, false, "he");
    expect(label).toContain("שעה");
    expect(label).toContain("7 דקות");
    expect(label).toContain("ו־57 שניות");
    expect(label).not.toMatch(/\d[hms]/);
  });

  it.each(["ar", "fa"] as const)("localizes work and units in %s", (locale) => {
    const label = formatTurnWorkLabel(72_000, false, locale);
    expect(label).toMatch(locale === "ar" ? /دقيقة/ : /دقیقه/);
    expect(label).toMatch(locale === "ar" ? /ثانية/ : /ثانیه/);
    expect(label).not.toMatch(/[a-z]/i);
  });

  it("retains short durations and handles unknown or invalid timing", () => {
    expect(formatTurnWorkLabel(8_500, false, "he")).toContain("8.5 שניות");
    expect(formatTurnWorkLabel(500, false, "he")).toContain("500");
    expect(formatTurnWorkLabel(0, false, "he")).toContain("אלפית");
    for (const value of [null, NaN, Infinity, -1]) {
      expect(formatTurnWorkLabel(value, false, "he")).toBe("עבד");
      expect(formatTurnWorkLabel(value, true, "he")).toBe("הפסקת את התגובה הזו");
    }
  });
});
