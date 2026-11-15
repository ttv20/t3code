import { expect, it } from "vite-plus/test";

import { nativeLanguageName } from "./locales.ts";

it.each([
  ["he", "עברית"],
  ["ar", "العربية"],
  ["fa", "فارسی"],
  ["en", "English"],
  ["pt-BR", "Português (Brasil)"],
  ["ja", "日本語"],
  ["unknown", "unknown"],
])("displays %s in its own language", (locale, name) => {
  expect(nativeLanguageName(locale)).toBe(name);
});
