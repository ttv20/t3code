import { describe, expect, it } from "vite-plus/test";
import {
  formatUiResetCredits,
  formatUiUsageReset,
  formatUiUsageWindowLabel,
} from "./usageLocalization.ts";
import { createUiTranslator } from "./i18n.ts";

const now = Date.parse("2026-10-15T10:00:00Z");
const future = "2026-10-15T14:42:00.000Z";

describe("usage quota translations", () => {
  it("translates quota periods without translating a model's name", () => {
    expect(formatUiUsageWindowLabel("Weekly · Fable", "he")).toBe("מכסה שבועית · Fable");
    expect(formatUiUsageWindowLabel("Session", "he")).toBe("מכסה שוטפת");
    expect(formatUiUsageWindowLabel("Weekly · Fable", "en")).toBe("Weekly · Fable");
  });
  it("uses complete Hebrew labels and summaries instead of positional Left or English fragments", () => {
    const t = createUiTranslator("he");
    expect(t("Remaining quota")).toBe("נותר");
    expect(t("Left")).toBe("שמאל");
    expect(t("Claude Team Subscription")).toBe("מינוי Claude לצוותים");
    expect(formatUiUsageReset({ resetsAt: future }, now, "he")).toBe("איפוס בעוד 4h 42m");
    expect(formatUiResetCredits({ availableCount: 1 }, now, "he")).toBe("1 איפוס זמין");
    expect(formatUiResetCredits({ availableCount: 2 }, now, "he")).toBe("2 איפוסים זמינים");
    expect(formatUiResetCredits({ availableCount: 0 }, now, "he")).toBe("אין איפוסים זמינים");
  });
  it.each(["he", "ar", "fa"] as const)("localizes reset and expiry text in %s", (locale) => {
    const summary = formatUiResetCredits(
      { availableCount: 1, nextExpiresAt: future },
      now,
      locale,
      true,
    );
    expect(summary).not.toMatch(/banked|expires/);
    expect(summary).toContain("4h 42m");
    expect(
      formatUiResetCredits(
        {
          availableCount: 1,
          nextExpiresAt: "2026-10-22T19:00:00.000Z",
        },
        now,
        locale,
        true,
      ),
    ).toContain("7d 9h");
    expect(formatUiUsageReset({ resetsAt: future }, now, locale)).not.toContain("resets in");
    expect(formatUiUsageReset({}, now, locale)).toBeNull();
    expect(formatUiUsageReset({ resetsAt: "invalid" }, now, locale)).toBeNull();
    expect(formatUiUsageReset({ resetsAt: "2026-10-15T10:00:00.000Z" }, now, locale)).not.toContain(
      "resets now",
    );
  });
  it("preserves English duration precision and reset-credit wording", () => {
    expect(formatUiUsageReset({ resetsAt: future }, now, "en")).toBe("resets in 4h 42m");
    expect(
      formatUiResetCredits({ availableCount: 2, nextExpiresAt: future }, now, "en", true),
    ).toBe("2 banked · expires in 4h 42m");
  });

  it.each([
    ["en", "in 4h 42m"],
    ["he", "תוך 4h 42m"],
    ["ar", "خلال 4h 42m"],
    ["fa", "تا 4h 42m"],
  ] as const)("uses a short composer countdown in %s", (locale, expected) => {
    expect(formatUiUsageReset({ resetsAt: future }, now, locale, true)).toBe(expected);
    expect(formatUiUsageReset({}, now, locale, true)).toBeNull();
    expect(formatUiUsageReset({ resetsAt: "invalid" }, now, locale, true)).toBeNull();
    expect(formatUiUsageReset({ resetsAt: "2026-10-15T10:00:00.000Z" }, now, locale, true)).toBe(
      formatUiUsageReset({ resetsAt: "2026-10-15T10:00:00.000Z" }, now, locale),
    );
  });
});
