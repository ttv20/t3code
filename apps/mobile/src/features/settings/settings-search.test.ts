import { createUiMessageResolver } from "@t3tools/client-runtime/i18n";
import { describe, expect, it } from "vite-plus/test";

import { filterSettingsSections } from "./settings-search";

const SECTIONS = [
  { rows: [{ id: "usage", label: "Usage" }] },
  {
    title: "Connections",
    rows: [
      { id: "account", label: "T3 Account" },
      { id: "SettingsEnvironments", label: "Environments" },
    ],
  },
  {
    title: "Interface",
    rows: [
      { id: "SettingsAppearance", label: "Appearance" },
      { id: "SettingsKeyboard", label: "Keyboard" },
      { id: "SettingsVoice", label: "Voice" },
      { id: "SettingsOrganization", label: "General" },
    ],
  },
  {
    title: "Server settings",
    rows: [
      { id: "SettingsProviderAccounts", label: "Provider accounts" },
      { id: "SettingsEnvironmentSourceControl", label: "Source control & issues" },
    ],
  },
];

function visible(query: string, locale: "en" | "he" | "ar" | "fa" = "en") {
  return filterSettingsSections(SECTIONS, query, createUiMessageResolver(locale), locale).map(
    (section) => [section.title ?? null, section.rows.map((row) => row.label)],
  );
}

describe("filterSettingsSections", () => {
  it.each([
    {
      query: "",
      expected: SECTIONS.map((section) => [
        section.title ?? null,
        section.rows.map((row) => row.label),
      ]),
    },
    { query: "   ", expected: visible("") },
    { query: "appear", expected: [["Interface", ["Appearance"]]] },
    { query: "KEYBOARD", expected: [["Interface", ["Keyboard"]]] },
    { query: "dark mode", expected: [["Interface", ["Appearance"]]] },
    { query: "microphone", expected: [["Interface", ["Voice"]]] },
    { query: "agent credits", expected: [["Server settings", ["Source control & issues"]]] },
    {
      query: "server settings",
      expected: [["Server settings", ["Provider accounts", "Source control & issues"]]],
    },
    {
      query: "accounts",
      expected: [["Server settings", ["Provider accounts"]]],
    },
    { query: "usage", expected: [[null, ["Usage"]]] },
    { query: "zzzz", expected: [] },
    { query: "מראה", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    {
      query: "ממשק",
      locale: "he" as const,
      expected: [["Interface", ["Appearance", "Keyboard", "Voice", "General"]]],
    },
    { query: "גודל הגופן", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "appearance", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "المظهر", locale: "ar" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "ظاهر", locale: "fa" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "עברית", locale: "he" as const, expected: [["Interface", ["General"]]] },
    { query: "עברית", expected: [["Interface", ["General"]]] },
    { query: "Hebrew", expected: [["Interface", ["General"]]] },
    { query: "RTL", expected: [["Interface", ["General"]]] },
    { query: "working", locale: "he" as const, expected: [["Interface", ["General"]]] },
    { query: "العربية", locale: "ar" as const, expected: [["Interface", ["General"]]] },
    { query: "فارسی", locale: "fa" as const, expected: [["Interface", ["General"]]] },
  ])("$query", ({ query, expected, ...options }) => {
    expect(visible(query, "locale" in options ? options.locale : "en")).toEqual(expected);
  });

  it("keeps English search available for rows already translated by the interface", () => {
    const translated = [{ title: "ממשק", rows: [{ id: "SettingsAppearance", label: "מראה" }] }];
    expect(
      filterSettingsSections(translated, "appearance", createUiMessageResolver("he"), "he"),
    ).toEqual(translated);
    expect(
      filterSettingsSections(translated, "interface", createUiMessageResolver("he"), "he"),
    ).toEqual(translated);
    expect(filterSettingsSections(translated, "מראה", createUiMessageResolver("he"), "he")).toEqual(
      translated,
    );
  });

  it("drops sections that start empty", () => {
    expect(filterSettingsSections([{ rows: [] }, ...SECTIONS], "").length).toBe(SECTIONS.length);
  });
});
