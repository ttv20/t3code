import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveComposerUsageWindows } from "./composerUsageIndicator.logic";

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

  it("includes both Codex session and weekly limits when reported", () => {
    const usage = resolveComposerUsageWindows(provider("codex"));

    expect(usage?.session?.id).toBe("five_hour");
    expect(usage?.weekly?.id).toBe("seven_day");
  });

  it.each(["codex", "claudeAgent"] as const)("retains session-only limits for %s", (driver) => {
    const original = provider(driver);
    const session = original.usageLimits!.windows[0]!;
    const usage = resolveComposerUsageWindows({
      ...original,
      usageLimits: { checkedAt: original.checkedAt, windows: [session] },
    });
    expect(usage?.session).toEqual(session);
    expect(usage?.weekly).toBeNull();
  });

  it("omits the indicator when no supported quota windows are reported", () => {
    expect(resolveComposerUsageWindows(null)).toBeNull();
    expect(
      resolveComposerUsageWindows({ ...provider("codex"), usageLimits: undefined }),
    ).toBeNull();
    expect(
      resolveComposerUsageWindows({
        ...provider("codex"),
        usageLimits: { checkedAt: "2026-09-22T10:00:00.000Z", windows: [] },
      }),
    ).toBeNull();
  });
});
