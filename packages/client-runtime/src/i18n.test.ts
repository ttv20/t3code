import { HEBREW_UI_MESSAGES } from "./locales/he.ts";
import { ARABIC_UI_MESSAGES } from "./locales/ar.ts";
import { PERSIAN_UI_MESSAGES } from "./locales/fa.ts";

import { describe, expect, it } from "vite-plus/test";

import {
  createUiTranslator,
  formatUiRelativeTime,
  resolveUiDirection,
  resolveUiLocale,
  translateUiText,
} from "./i18n.ts";

describe("interface localization", () => {
  it.each(["en", "he", "ar", "fa"] as const)("formats past and future instants in %s", (locale) => {
    const now = Date.parse("2026-10-15T00:00:00Z");
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    expect(formatUiRelativeTime("2026-10-14T23:55:00Z", locale, now)).toBe(
      formatter.format(-5, "minute"),
    );
    expect(formatUiRelativeTime("2026-10-15T03:00:00Z", locale, now)).toBe(
      formatter.format(3, "hour"),
    );
    expect(formatUiRelativeTime("2026-10-17T00:00:00Z", locale, now)).toBe(
      formatter.format(2, "day"),
    );
    expect(formatUiRelativeTime("2026-10-15T00:00:00Z", locale, now)).toBe(
      formatter.format(0, "second"),
    );
    expect(formatUiRelativeTime("invalid", locale, now)).toBeNull();
  });
  it("keeps an explicit choice independent of the system language", () => {
    expect(resolveUiLocale("en", ["he-IL"])).toBe("en");
    expect(resolveUiLocale("he", ["en-US"])).toBe("he");
  });

  it.each(["he", "he-IL", "HE_il", "iw-IL"])("recognizes Hebrew system locale %s", (tag) => {
    expect(resolveUiLocale("system", [tag])).toBe("he");
  });

  it("selects the first supported system locale and falls back to English", () => {
    expect(resolveUiLocale("system", ["fr-FR", "he-IL", "en-US"])).toBe("he");
    expect(resolveUiLocale("system", ["en-GB", "he-IL"])).toBe("en");
    expect(resolveUiLocale("system", ["fr-FR"])).toBe("en");
    expect(resolveUiLocale("system")).toBe("en");
  });

  it("follows the interface language until direction is overridden", () => {
    expect(resolveUiDirection("he", "auto")).toBe("rtl");
    expect(resolveUiDirection("en", "auto")).toBe("ltr");
    expect(resolveUiDirection("he", "ltr")).toBe("ltr");
    expect(resolveUiDirection("en", "rtl")).toBe("rtl");
  });

  it.each(["ar", "fa"] as const)("resolves and translates %s independently of Hebrew", (locale) => {
    expect(resolveUiLocale("system", [`${locale}-XX`, "en-US"])).toBe(locale);
    expect(resolveUiLocale(locale, ["he-IL"])).toBe(locale);
    expect(resolveUiDirection(locale, "auto")).toBe("rtl");
    expect(resolveUiDirection(locale, "ltr")).toBe("ltr");
    expect(createUiTranslator(locale)("Settings")).toBe(locale === "ar" ? "الإعدادات" : "تنظیمات");
    expect(createUiTranslator(locale)("Worktree")).toBe("worktree");
    expect(createUiTranslator(locale)("Untranslated interface label")).toBe(
      "Untranslated interface label",
    );
  });

  it("translates interface labels and leaves missing entries intact", () => {
    const t = createUiTranslator("he");
    expect(t("Settings")).toBe("הגדרות");
    expect(t("New thread")).toBe("שיחה חדשה");
    expect(t("Interface language")).toBe("שפת הממשק");
    expect(t("Untranslated interface label")).toBe("Untranslated interface label");
    expect(t("constructor")).toBe("constructor");
    expect(t("__proto__")).toBe("__proto__");
    expect(translateUiText("en", "Settings")).toBe("Settings");
  });
  it("interpolates values without treating their contents as interface copy", () => {
    const t = createUiTranslator("he");
    expect(t('Delete action "{0}"?', { "0": "Settings" })).toContain("Settings");
    expect(t("Reset {0} to default", { "0": 0 })).toContain("0");
    expect(t("Reset {0} to default", { "0": "$& {1}" })).toContain("$& {1}");
    expect(createUiTranslator("en")("Reset {0} to default", { "0": "color" })).toBe(
      "Reset color to default",
    );
    const slot = { type: "custom" };
    expect(t(slot)).toBe(slot);
    expect(t(undefined)).toBeUndefined();
  });

  it.each([
    ["he", HEBREW_UI_MESSAGES],
    ["ar", ARABIC_UI_MESSAGES],
    ["fa", PERSIAN_UI_MESSAGES],
  ] as const)("retains placeholders and code examples in the %s catalog", (_locale, messages) => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(HEBREW_UI_MESSAGES).sort());
    for (const [source, translated] of Object.entries(messages)) {
      expect(translated.trim(), source).not.toBe("");
      expect(translated.match(/\{\w+\}/g)?.sort() ?? [], source).toEqual(
        source.match(/\{\w+\}/g)?.sort() ?? [],
      );
      expect(translated.match(/\{\{[^}]+\}\}/g)?.sort() ?? [], source).toEqual(
        source.match(/\{\{[^}]+\}\}/g)?.sort() ?? [],
      );
      expect(translated, source).not.toMatch(/ZXQ\d+QXZ|QX[IP]\d+|PXQ|IXQ/);
      for (const example of source.match(/`[^`]+`/g) ?? []) {
        expect(translated, source).toContain(example);
      }
      if (source.startsWith("{\n") || source.startsWith("~/")) {
        expect(translated, source).toBe(source);
      }
    }
  });
});
