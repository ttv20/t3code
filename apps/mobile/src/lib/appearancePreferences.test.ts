import { describe, expect, it } from "vite-plus/test";

import {
  resolveAppearance,
  resolveAppearancePreferences,
  resolveNativeMarkdownTypography,
} from "./appearancePreferences";

describe("appearancePreferences", () => {
  it("migrates the legacy markdownFontSize key to baseFontSize", () => {
    expect(resolveAppearancePreferences({ markdownFontSize: 18 }).baseFontSize).toBe(18);
    expect(
      resolveAppearancePreferences({ baseFontSize: 16, markdownFontSize: 18 }).baseFontSize,
    ).toBe(16);
  });
});

describe("chat line height", () => {
  it("keeps the existing spacing until a custom height is selected", () => {
    const appearance = resolveAppearance(resolveAppearancePreferences({ chatFontSize: 14 }));
    expect(appearance.chatLineHeight).toBe(20);
    expect(appearance.isChatLineHeightCustom).toBe(false);
  });

  it("holds line height independently of font size and passes it to native Markdown", () => {
    for (const chatFontSize of [12, 14, 18]) {
      const appearance = resolveAppearance(
        resolveAppearancePreferences({ chatFontSize, chatLineHeight: 28 }),
      );
      const typography = resolveNativeMarkdownTypography(
        appearance.chatFontSize,
        appearance.chatLineHeight,
      );
      expect(typography.fontSize).toBe(chatFontSize);
      expect(typography.lineHeight).toBe(28);
      expect(appearance.isChatLineHeightCustom).toBe(true);
    }
  });

  it("restores automatic spacing and bounds saved values to keep text legible", () => {
    expect(
      resolveAppearance(resolveAppearancePreferences({ chatFontSize: 14, chatLineHeight: null }))
        .chatLineHeight,
    ).toBe(20);
    expect(resolveAppearancePreferences({ chatLineHeight: Infinity }).chatLineHeight).toBeNull();
    expect(resolveAppearancePreferences({ chatLineHeight: 100 }).chatLineHeight).toBe(48);
    const largeText = resolveAppearance(
      resolveAppearancePreferences({ chatFontSize: 22, chatLineHeight: 16 }),
    );
    expect(largeText.chatLineHeight).toBe(24);
  });
});

describe("chat text size", () => {
  it("inherits interface sizing until a separate chat size is selected", () => {
    const inherited = resolveAppearance(resolveAppearancePreferences({ baseFontSize: 18 }));
    expect(inherited.chatFontSize).toBe(18);
    expect(inherited.isChatFontSizeCustom).toBe(false);
    const custom = resolveAppearance(
      resolveAppearancePreferences({ baseFontSize: 18, chatFontSize: 14 }),
    );
    expect(custom.chatFontSize).toBe(14);
    expect(custom.baseFontSize).toBe(18);
    expect(custom.isChatFontSizeCustom).toBe(true);
    expect(
      resolveAppearance(resolveAppearancePreferences({ baseFontSize: 18, chatFontSize: null }))
        .chatFontSize,
    ).toBe(18);
  });

  it("normalizes saved chat sizing without changing the legacy migration", () => {
    expect(resolveAppearancePreferences({ chatFontSize: 100 }).chatFontSize).toBe(22);
    expect(resolveAppearancePreferences({ chatFontSize: 1 }).chatFontSize).toBe(11);
    expect(resolveAppearancePreferences({ chatFontSize: NaN }).chatFontSize).toBeNull();
    const legacy = resolveAppearance(resolveAppearancePreferences({ markdownFontSize: 17 }));
    expect(legacy.baseFontSize).toBe(17);
    expect(legacy.chatFontSize).toBe(17);
    expect(legacy.isChatFontSizeCustom).toBe(false);
  });
});
