import { formatDuration } from "@t3tools/shared/orchestrationTiming";
import { createUiTranslator, type UiLocale } from "./i18n.ts";

type WorkDurationUnit = "hour" | "minute" | "second" | "millisecond";
const unitFormatters = new Map<string, Intl.NumberFormat>();

function formatWorkDuration(elapsedMs: number, locale: UiLocale): string {
  if (locale === "en") return formatDuration(elapsedMs);
  const unit = (value: number, name: WorkDurationUnit) => {
    const key = `${locale}:${name}`;
    let formatter = unitFormatters.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: "unit",
        unit: name,
        unitDisplay: "long",
        maximumFractionDigits: name === "millisecond" ? 0 : 1,
      });
      unitFormatters.set(key, formatter);
    }
    return formatter.format(value);
  };
  if (elapsedMs < 1_000) return unit(Math.max(1, Math.round(elapsedMs)), "millisecond");
  if (elapsedMs < 60_000) {
    return unit(
      elapsedMs < 10_000 ? Math.round(elapsedMs / 100) / 10 : Math.round(elapsedMs / 1_000),
      "second",
    );
  }
  const totalSeconds = Math.round(elapsedMs / 1_000);
  const parts: string[] = [];
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) parts.push(unit(hours, "hour"));
  if (minutes > 0) parts.push(unit(minutes, "minute"));
  if (seconds > 0) parts.push(unit(seconds, "second"));
  const last = parts.pop()!;
  return parts.length === 0
    ? last
    : createUiTranslator(locale)("{0} and {1}", { "0": parts.join(", "), "1": last });
}

/** Localize settled work labels without changing compact usage-limit durations. */
export function formatTurnWorkLabel(
  elapsedMs: number | null,
  interrupted: boolean,
  locale: UiLocale = "en",
): string {
  const t = createUiTranslator(locale);
  if (elapsedMs === null || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return t(interrupted ? "You stopped this response" : "Worked");
  }
  return t(interrupted ? "You stopped after {0}" : "Worked for {0}", {
    "0": formatWorkDuration(elapsedMs, locale),
  });
}
