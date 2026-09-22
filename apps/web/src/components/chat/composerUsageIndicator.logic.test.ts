import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  formatCompactResetCountdown,
  resolveComposerUsageWindows,
} from "./composerUsageIndicator.logic";

function provider(driver: "codex" | "claudeAgent"): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-09-22T10:00:00.000Z",
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits: {
      checkedAt: "2026-09-22T10:00:00.000Z",
      windows: [
        {
          id: "five_hour",
          kind: "session",
          label: "Session",
          usedPercent: 38,
          resetsAt: "2026-09-22T11:47:00.000Z",
          windowDurationMins: 300,
        },
        {
          id: "seven_day",
          kind: "weekly",
          label: "Weekly",
          usedPercent: 16,
          windowDurationMins: 10_080,
        },
        {
          id: "seven_day_opus",
          kind: "weekly",
          label: "Opus weekly",
          usedPercent: 25,
          windowDurationMins: 10_080,
        },
      ],
    },
  };
}

describe("composer usage indicator", () => {
  it("selects Claude's account-wide five-hour and seven-day windows", () => {
    const usage = resolveComposerUsageWindows(provider("claudeAgent"));

    expect(usage?.session?.id).toBe("five_hour");
    expect(usage?.weekly?.id).toBe("seven_day");
    expect(usage?.details).toHaveLength(3);
  });

  it("keeps Codex to one weekly window", () => {
    const usage = resolveComposerUsageWindows(provider("codex"));

    expect(usage?.session).toBeNull();
    expect(usage?.weekly?.id).toBe("seven_day");
  });

  it("formats a minute-updated countdown without spaces", () => {
    const now = Date.parse("2026-09-22T10:00:00.000Z");

    expect(formatCompactResetCountdown("2026-09-22T11:47:00.000Z", now)).toBe("1h47");
    expect(formatCompactResetCountdown("2026-09-22T10:09:20.000Z", now)).toBe("10m");
    expect(formatCompactResetCountdown("2026-09-22T10:00:00.000Z", now)).toBe("now");
    expect(formatCompactResetCountdown(undefined, now)).toBeNull();
  });
});
