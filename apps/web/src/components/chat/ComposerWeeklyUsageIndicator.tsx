import type { EnvironmentId, ServerProvider } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { useState } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { formatDayAwareTimestamp, formatUpcomingTimestamp } from "../../timestampFormat";
import { RefreshIcon } from "../ui/refresh-icon";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

export function hasCodexWeeklyUsage(provider: ServerProvider | null): boolean {
  return (
    provider?.driver === "codex" &&
    provider.usageLimits?.windows.some((window) => window.kind === "weekly") === true
  );
}

export function ComposerWeeklyUsageIndicator(props: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | null;
}) {
  const { environmentId, provider } = props;
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const weekly = provider?.usageLimits?.windows
    .filter((window) => window.kind === "weekly")
    .toSorted((left, right) => (right.windowDurationMins ?? 0) - (left.windowDurationMins ?? 0))[0];

  if (provider?.driver !== "codex" || !weekly) return null;

  const remaining = remainingPercent(weekly);
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
            size="sm"
            variant="ghost-muted"
            className="h-7 rounded-full px-2 text-[11px] tabular-nums"
            aria-label={`Codex weekly usage ${remaining}% remaining`}
          >
            {remaining}% wk
          </Button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="end"
        viewportClassName="p-0"
        className="w-64 max-w-none text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-[var(--floating-content-inset)]">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-xs text-foreground">Codex weekly usage</span>
            {provider.auth.email ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {provider.auth.email}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">Remaining</span>
            <span className="text-end font-medium tabular-nums">{remaining}%</span>
            {weekly.resetsAt ? (
              <>
                <span className="text-muted-foreground">Resets</span>
                <span className="text-end tabular-nums">
                  {formatUpcomingTimestamp(weekly.resetsAt, timestampFormat)}
                </span>
              </>
            ) : null}
            <span className="text-muted-foreground">Last checked</span>
            <span className="text-end tabular-nums">
              {formatDayAwareTimestamp(provider.usageLimits!.checkedAt, timestampFormat)}
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
            <RefreshIcon className="size-3.5" refreshing={isRefreshing} />
            {isRefreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
