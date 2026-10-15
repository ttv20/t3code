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
  if (provider?.driver !== "claudeAgent" && provider?.driver !== "codex") return null;

  const session =
    windows.find((window) => window.id === "five_hour") ?? longestWindow(windows, "session");
  const weekly =
    windows.find((window) => window.id === "seven_day") ?? longestWindow(windows, "weekly");
  return session || weekly
    ? {
        providerLabel: provider.driver === "codex" ? "Codex" : "Claude",
        session,
        weekly,
        details: windows,
      }
    : null;
}
