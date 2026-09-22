import type { ServerProvider, ServerProviderUsageWindow } from "@t3tools/contracts";

export interface ComposerUsageWindows {
  readonly providerLabel: "Claude" | "Codex";
  readonly session: ServerProviderUsageWindow | null;
  readonly weekly: ServerProviderUsageWindow | null;
  readonly details: readonly ServerProviderUsageWindow[];
}

function longestWindow(
  windows: readonly ServerProviderUsageWindow[],
  kind: ServerProviderUsageWindow["kind"],
): ServerProviderUsageWindow | null {
  return (
    windows
      .filter((window) => window.kind === kind)
      .toSorted(
        (left, right) => (right.windowDurationMins ?? 0) - (left.windowDurationMins ?? 0),
      )[0] ?? null
  );
}

export function resolveComposerUsageWindows(
  provider: ServerProvider | null,
): ComposerUsageWindows | null {
  const windows = provider?.usageLimits?.windows ?? [];
  if (provider?.driver === "codex") {
    const weekly = longestWindow(windows, "weekly");
    return weekly ? { providerLabel: "Codex", session: null, weekly, details: windows } : null;
  }
  if (provider?.driver !== "claudeAgent") return null;

  const session =
    windows.find((window) => window.id === "five_hour") ?? longestWindow(windows, "session");
  const weekly =
    windows.find((window) => window.id === "seven_day") ?? longestWindow(windows, "weekly");
  return session || weekly ? { providerLabel: "Claude", session, weekly, details: windows } : null;
}

/** A minute-sized reset label for the narrow composer control, such as `1h47`. */
export function formatCompactResetCountdown(
  resetsAt: string | undefined,
  now: number,
): string | null {
  if (!resetsAt) return null;
  const reset = Date.parse(resetsAt);
  if (!Number.isFinite(reset)) return null;
  if (reset <= now) return "now";

  const minutes = Math.max(1, Math.ceil((reset - now) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h${remainingMinutes}`;
}
