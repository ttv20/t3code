import type { EnvironmentId, ServerProvider } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { useState } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { formatDayAwareTimestamp, formatUpcomingTimestamp } from "../../timestampFormat";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { RefreshIcon } from "../ui/refresh-icon";

import {
  formatCompactResetCountdown,
  resolveComposerUsageWindows,
} from "./composerUsageIndicator.logic";

export function hasComposerUsage(provider: ServerProvider | null): boolean {
  return resolveComposerUsageWindows(provider) !== null;
}

export function ComposerUsageIndicator(props: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | null;
}) {
  const { environmentId, provider } = props;
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00.000Z`);
  const usage = resolveComposerUsageWindows(provider);

  if (!provider || !usage || !provider.usageLimits) return null;

  const sessionRemaining = usage.session ? remainingPercent(usage.session) : null;
  const weeklyRemaining = usage.weekly ? remainingPercent(usage.weekly) : null;
  const sessionReset = usage.session
    ? formatCompactResetCountdown(usage.session.resetsAt, now)
    : null;
  const ariaLabel = [
    usage.session
      ? `five-hour usage ${sessionRemaining}% remaining${sessionReset ? `, resets in ${sessionReset}` : ""}`
      : null,
    usage.weekly ? `weekly usage ${weeklyRemaining}% remaining` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshProviders({
        environmentId,
        input: { instanceId: provider.instanceId },
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={150}
        render={
          <Button
            size="compact-stacked"
            variant="ghost-muted"
            aria-label={`${usage.providerLabel} ${ariaLabel}`}
          >
            {usage.session ? (
              <span className="flex items-center gap-1 tabular-nums">
                <span>5h</span>
                <span className="font-semibold text-foreground">{sessionRemaining}%</span>
                {sessionReset ? <span>· {sessionReset}</span> : null}
              </span>
            ) : null}
            {usage.weekly ? (
              <span className="flex items-center gap-1 tabular-nums">
                <span>7d</span>
                <span className="font-semibold text-foreground">{weeklyRemaining}%</span>
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="end"
        className="w-64 max-w-none text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 py-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-xs text-foreground">{usage.providerLabel} usage</span>
            {provider.auth.email ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {provider.auth.email}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5 text-[11px]">
            {usage.details.map((window) => (
              <div key={window.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
                <span className="truncate text-muted-foreground">{window.label}</span>
                <span className="text-end font-medium tabular-nums">
                  {remainingPercent(window)}%
                </span>
                {window.resetsAt ? (
                  <span className="col-span-2 text-end text-muted-foreground tabular-nums">
                    Resets {formatUpcomingTimestamp(window.resetsAt, timestampFormat, now)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-[11px]">
            <span className="text-muted-foreground">Last checked</span>
            <span className="text-end tabular-nums">
              {formatDayAwareTimestamp(provider.usageLimits.checkedAt, timestampFormat)}
            </span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="w-full"
            disabled={isRefreshing}
            onClick={() => void refresh()}
          >
            <RefreshIcon size="sm" refreshing={isRefreshing} />
            {isRefreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
