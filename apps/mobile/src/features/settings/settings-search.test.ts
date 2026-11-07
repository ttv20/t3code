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
    ],
  },
  {
    title: "Server settings",
    rows: [
      { id: "SettingsProviderAccounts", label: "Provider accounts" },
      { id: "SettingsEnvironmentSourceControl", label: "Source control" },
    ],
  },
];

function visible(query: string, locale: "en" | "he" | "ar" | "fa" = "en") {
  return filterSettingsSections(SECTIONS, query, locale).map((section) => [
    section.title ?? null,
    section.rows.map((row) => row.label),
  ]);
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
    { query: "agent credits", expected: [["Server settings", ["Source control"]]] },
    {
      query: "server settings",
      expected: [["Server settings", ["Provider accounts", "Source control"]]],
    },
    {
      query: "accounts",
      expected: [["Server settings", ["Provider accounts"]]],
    },
    { query: "usage", expected: [[null, ["Usage"]]] },
    { query: "zzzz", expected: [] },
    { query: "מראה", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "ממשק", locale: "he" as const, expected: [["Interface", ["Appearance", "Keyboard"]]] },
    { query: "גודל הגופן", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "appearance", locale: "he" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "المظهر", locale: "ar" as const, expected: [["Interface", ["Appearance"]]] },
    { query: "ظاهر", locale: "fa" as const, expected: [["Interface", ["Appearance"]]] },
  ])("$query", ({ query, expected, ...options }) => {
    expect(visible(query, "locale" in options ? options.locale : "en")).toEqual(expected);
  });

  it("keeps English search available for rows already translated by the interface", () => {
    const translated = [{ title: "ממשק", rows: [{ id: "SettingsAppearance", label: "מראה" }] }];
    expect(filterSettingsSections(translated, "appearance", "he")).toEqual(translated);
    expect(filterSettingsSections(translated, "interface", "he")).toEqual(translated);
    expect(filterSettingsSections(translated, "מראה", "he")).toEqual(translated);
  });

  it("drops sections that start empty", () => {
    expect(filterSettingsSections([{ rows: [] }, ...SECTIONS], "").length).toBe(SECTIONS.length);
  });
});
