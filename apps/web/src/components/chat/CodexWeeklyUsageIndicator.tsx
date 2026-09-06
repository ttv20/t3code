import type { CodexWeeklyUsageResult, EnvironmentId, ThreadId } from "@t3tools/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

const CODEX_USAGE_REFRESH_MS = 10 * 60 * 1_000;

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatResetTimestamp(value: number | null): string | null {
  if (value === null) return null;
  const date = new Date(value * 1_000);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}

export function CodexWeeklyUsageIndicator(props: {
  active: boolean;
  environmentId: EnvironmentId;
  threadId: ThreadId | null;
}) {
  const { active, environmentId, threadId } = props;
  const readUsage = useAtomCommand(serverEnvironment.getCodexWeeklyUsage, {
    reportFailure: false,
  });
  const inFlightRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const [usage, setUsage] = useState<CodexWeeklyUsageResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let disposed = false;
    setUsage(null);
    setIsRefreshing(false);
    if (!active || threadId === null) return;

    const refresh = async (forceRefresh = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (!disposed) setIsRefreshing(true);
      try {
        const result = await readUsage({
          environmentId,
          input: { threadId, ...(forceRefresh ? { forceRefresh: true } : {}) },
        });
        if (!disposed && result._tag === "Success") setUsage(result.value);
      } finally {
        inFlightRef.current = false;
        if (!disposed) setIsRefreshing(false);
      }
    };

    refreshRef.current = () => refresh(true);
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), CODEX_USAGE_REFRESH_MS);
    return () => {
      disposed = true;
      refreshRef.current = async () => {};
      window.clearInterval(intervalId);
    };
  }, [active, environmentId, readUsage, threadId]);

  if (!active || usage === null) return null;

  const remainingPercent = Math.round(usage.remainingPercent);
  const resetAt = formatResetTimestamp(usage.resetsAt);
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <Button
            size="sm"
            variant="ghost-muted"
            className="h-7 rounded-full px-2 text-[11px] tabular-nums text-muted-foreground"
            aria-label={`Codex weekly usage ${remainingPercent}% remaining`}
          >
            {remainingPercent}% wk
          </Button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="end"
        className="w-64 max-w-none text-left whitespace-normal"
      >
        <div className="space-y-1.5">
          <div className="font-medium text-xs">Codex weekly usage</div>
          {usage.accountEmail ? (
            <div className="truncate text-secondary-label text-[11px]">{usage.accountEmail}</div>
          ) : null}
          <div className="flex justify-between gap-4 text-[11px]">
            <span className="text-secondary-label">Remaining</span>
            <span className="font-medium tabular-nums">{remainingPercent}%</span>
          </div>
          {resetAt ? (
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-secondary-label">Resets</span>
              <span className="text-right tabular-nums">{resetAt}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 text-[11px]">
            <span className="text-secondary-label">Last checked</span>
            <span className="text-right tabular-nums">{formatTimestamp(usage.checkedAt)}</span>
          </div>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="mt-1 w-full"
            disabled={isRefreshing}
            onClick={() => void refreshRef.current()}
          >
            <RefreshCwIcon
              className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden
            />
            {isRefreshing ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
