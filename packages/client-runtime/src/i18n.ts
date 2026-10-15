import { HEBREW_UI_MESSAGES } from "./locales/he.ts";
import { ARABIC_UI_MESSAGES } from "./locales/ar.ts";
import { PERSIAN_UI_MESSAGES } from "./locales/fa.ts";
import type { InterfaceDirection, InterfaceLanguage } from "@t3tools/contracts/settings";

export type UiLocale = Exclude<InterfaceLanguage, "system">;
export type UiDirection = "ltr" | "rtl";

export const INTERFACE_LANGUAGES = [
  { value: "system", label: "System" },
  { value: "en", label: "English" },
  { value: "he", label: "עברית" },
  { value: "ar", label: "العربية" },
  { value: "fa", label: "فارسی" },
] as const;

export const INTERFACE_DIRECTIONS = [
  { value: "auto", label: "Automatic" },
  { value: "ltr", label: "Left to right" },
  { value: "rtl", label: "Right to left" },
] as const;

/** Resolve the first supported system language, with English as the fallback. */
export function resolveUiLocale(
  language: InterfaceLanguage,
  systemLanguages: readonly string[] = [],
): UiLocale {
  if (language !== "system") return language;
  for (const tag of systemLanguages) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (base === "he" || base === "iw") return "he";
    if (base === "en") return "en";
    if (base === "ar" || base === "fa") return base;
  }
  return "en";
}

export function resolveUiDirection(locale: UiLocale, direction: InterfaceDirection): UiDirection {
  return direction === "auto" ? (locale === "en" ? "ltr" : "rtl") : direction;
}

const UI_MESSAGES: Readonly<Record<UiLocale, Readonly<Record<string, string>>>> = {
  en: {},
  he: HEBREW_UI_MESSAGES,
  ar: ARABIC_UI_MESSAGES,
  fa: PERSIAN_UI_MESSAGES,
};

// Scheduling uses Gregorian dates in every language so calendar selections and
// the server's date values describe the same day, including in Persian.
export const UI_DATE_LOCALES = {
  en: "en-US",
  he: "he-IL",
  ar: "ar-u-ca-gregory",
  fa: "fa-IR-u-ca-gregory",
} as const;

const relativeTimeFormatters = new Map<UiLocale, Intl.RelativeTimeFormat>();

/** Format past and future instants in the interface language; reject invalid dates. */
export function formatUiRelativeTime(value: string, locale: UiLocale, now = Date.now()) {
  const elapsedSeconds = (new Date(value).getTime() - now) / 1000;
  if (!Number.isFinite(elapsedSeconds)) return null;
  let formatter = relativeTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    relativeTimeFormatters.set(locale, formatter);
  }
  const magnitude = Math.abs(elapsedSeconds);
  if (magnitude < 60) return formatter.format(Math.round(elapsedSeconds), "second");
  if (magnitude < 3600) return formatter.format(Math.round(elapsedSeconds / 60), "minute");
  if (magnitude < 86400) return formatter.format(Math.round(elapsedSeconds / 3600), "hour");
  return formatter.format(Math.round(elapsedSeconds / 86400), "day");
}

// English source messages are also the fallback for UI copy awaiting translation.
// Call this only for interface labels, never for messages, paths, or provider output.

export type UiMessageValues = Readonly<Record<string, unknown>>;

export function translateUiText(
  locale: UiLocale,
  message: string,
  values?: UiMessageValues,
): string {
  const messages = UI_MESSAGES[locale];
  const translated = Object.hasOwn(messages, message) ? messages[message]! : message;
  return values
    ? translated.replace(/\{(\w+)\}/g, (token, key: string) =>
        Object.hasOwn(values, key) ? String(values[key]) : token,
      )
    : translated;
}

/** Translate interface copy; retain numbers, elements and other slot values as supplied. */
export function createUiTranslator(locale: UiLocale) {
  function translate(message: string, values?: UiMessageValues): string;
  function translate<A>(message: A, values?: UiMessageValues): A;
  function translate(message: unknown, values?: UiMessageValues) {
    return typeof message === "string" ? translateUiText(locale, message, values) : message;
  }
  return translate;
}

/** Stable slot identities let inline controls survive reordered translations. */
export function splitUiTextSlots(message: string) {
  const occurrences = new Map<string, number>();
  return message.split(/(\{\d+\})/g).map((text, index) => {
    const slot = /^\{(\d+)\}$/.exec(text)?.[1] ?? null;
    if (slot === null) return { key: `text-${index}`, text, slot };
    const occurrence = occurrences.get(slot) ?? 0;
    occurrences.set(slot, occurrence + 1);
    return { key: `slot-${slot}-${occurrence}`, text, slot };
  });
}
