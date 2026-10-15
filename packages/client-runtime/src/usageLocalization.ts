import type { ServerProviderResetCredits, ServerProviderUsageWindow } from "@t3tools/contracts";
import { formatDuration } from "@t3tools/shared/usageLimits";
import { createUiTranslator, type UiLocale } from "./i18n.ts";

/** Translate the window period while retaining a provider's model qualifier. */
export function formatUiUsageWindowLabel(label: string, locale: UiLocale): string {
  if (locale === "en") return label;
  const t = createUiTranslator(locale);
  const [period = "", ...qualifiers] = label.split(" · ");
  const title =
    period === "Session" ? t("Session quota") : period === "Weekly" ? t("Weekly quota") : t(period);
  return [title, ...qualifiers].join(" · ");
}

export function formatUiUsageReset(
  window: Pick<ServerProviderUsageWindow, "resetsAt">,
  now: number,
  locale: UiLocale,
): string | null {
  const resetAt = window.resetsAt ? Date.parse(window.resetsAt) : NaN;
  if (!Number.isFinite(resetAt)) return null;
  const t = createUiTranslator(locale);
  if (resetAt <= now) return t("resets now");
  if (resetAt - now < 60_000) return t("Resets momentarily");
  return t("resets in {0}", { "0": formatDuration(resetAt - now) });
}

export function formatUiResetCredits(
  credits: ServerProviderResetCredits,
  now: number,
  locale: UiLocale,
  compact = false,
): string {
  const t = createUiTranslator(locale);
  if (credits.availableCount === 0) return t("No reset credits banked");
  const summary = t(
    compact
      ? "{0} banked"
      : credits.availableCount === 1
        ? "{0} reset credit banked"
        : "{0} reset credits banked",
    { "0": credits.availableCount },
  );
  const expiresAt = credits.nextExpiresAt ? Date.parse(credits.nextExpiresAt) : NaN;
  if (!Number.isFinite(expiresAt)) return summary;
  return t(compact ? "{0} · expires in {1}" : "{0} · next expires in {1}", {
    "0": summary,
    "1": formatDuration(expiresAt - now),
  });
}
