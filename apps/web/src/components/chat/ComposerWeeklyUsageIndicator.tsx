import {
  formatUiResetCredits,
  formatUiUsageReset,
  formatUiUsageWindowLabel,
} from "@t3tools/client-runtime/usage-localization";
import type {
  EnvironmentId,
  ServerProvider,
  ServerProviderUsageLimits,
  ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { useState } from "react";

import { useNowMinute } from "../../hooks/useNowMinute";
import { usePrimarySettings } from "../../hooks/useSettings";
import { useUiLanguage } from "../../i18n";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { formatChatTimestampTooltip } from "../../timestampFormat";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { RefreshIcon } from "../ui/refresh-icon";
import { barColor, ResetCreditDialog, useResetCredit } from "../usage/UsageLimits";
import {
  resolveComposerUsageWindows,
  type ComposerUsageWindows,
} from "./composerUsageIndicator.logic";

function UsageMeter({
  window,
  driver,
  now,
}: {
  readonly window: ServerProviderUsageWindow;
  readonly driver: ServerProvider["driver"];
  readonly now: number;
}) {
  const { t: uiT, locale } = useUiLanguage();
  const label =
    window.kind === "session" && window.windowDurationMins === 300
      ? uiT("5-hour quota")
      : formatUiUsageWindowLabel(window.label, locale);
  const highUsage = window.usedPercent > 80;
  const resetsIn = formatUiUsageReset(window, now, locale);
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-muted-foreground">{label}</span>
        <span
          className={highUsage ? "shrink-0 text-destructive tabular-nums" : "shrink-0 tabular-nums"}
        >
          {uiT("{0}% used", { "0": Math.round(window.usedPercent) })}
        </span>
      </span>
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={window.usedPercent}
        className="relative h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <span
          className="absolute inset-y-0 start-0 rounded-full"
          style={{
            width: `${window.usedPercent}%`,
            backgroundColor: highUsage ? "var(--destructive)" : barColor(driver),
          }}
        />
      </span>
      {resetsIn ? (
        <span className="text-2xs text-muted-foreground tabular-nums">{resetsIn}</span>
      ) : null}
    </span>
  );
}

export function ComposerUsageIndicator({
  environmentId,
  provider,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | null;
}) {
  const usage = resolveComposerUsageWindows(provider);
  if (!provider?.usageLimits || !usage) return null;
  return (
    <ComposerUsagePanel
      key={`${environmentId}:${provider.instanceId}`}
      environmentId={environmentId}
      provider={provider}
      limits={provider.usageLimits}
      usage={usage}
    />
  );
}

function ComposerUsagePanel({
  environmentId,
  provider,
  limits,
  usage,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider;
  readonly limits: ServerProviderUsageLimits;
  readonly usage: ComposerUsageWindows;
}) {
  const { t: uiT, locale } = useUiLanguage();
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const reset = useResetCredit(environmentId, { instanceId: provider.instanceId });
  const now = Date.parse(`${useNowMinute()}:00.000Z`);
  const windows = [usage.session, usage.weekly].filter((window) => window !== null);
  const credits = limits.resetCredits;
  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshProviders({ environmentId, input: { instanceId: provider.instanceId } });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div data-chat-composer-usage className="px-3 pt-2 pb-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="grid w-full cursor-pointer grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-x-6 gap-y-2 rounded-sm text-start outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
          }
        >
          {windows.map((window) => (
            <UsageMeter key={window.id} window={window} driver={provider.driver} now={now} />
          ))}
        </PopoverTrigger>
        <PopoverPopup side="top" align="end" width="md" padding="compact">
          <div className="flex flex-col gap-3 text-start">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-medium">
                {uiT("{0} usage", { "0": usage.providerLabel })}
              </span>
              {provider.auth.email ? (
                <span className="truncate text-2xs text-muted-foreground" dir="auto">
                  {provider.auth.email}
                </span>
              ) : null}
            </div>
            {usage.details.map((window) => (
              <div key={window.id} className="flex flex-col gap-0.5">
                <UsageMeter window={window} driver={provider.driver} now={now} />
                {window.resetsAt ? (
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {uiT("Quota resets")}{" "}
                    {formatChatTimestampTooltip(window.resetsAt, timestampFormat, locale)}
                  </span>
                ) : null}
              </div>
            ))}
            {credits && credits.availableCount > 0 ? (
              <div className="flex flex-col items-start gap-2">
                <span className="text-2xs text-muted-foreground tabular-nums">
                  {formatUiResetCredits(credits, now, locale)}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={reset.busy || !reset.canManageProviders}
                  onClick={() => {
                    setOpen(false);
                    reset.setConfirming(true);
                  }}
                >
                  {reset.busy ? uiT("Using…") : uiT("Use reset")}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-between gap-x-3 text-2xs text-muted-foreground">
              <span>{uiT("Last checked")}</span>
              <span className="tabular-nums">
                {formatChatTimestampTooltip(limits.checkedAt, timestampFormat, locale)}
              </span>
            </div>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={isRefreshing}
              onClick={() => void refresh()}
            >
              <RefreshIcon size="sm" refreshing={isRefreshing} />
              {isRefreshing ? uiT("Refreshing…") : uiT("Refresh now")}
            </Button>
          </div>
        </PopoverPopup>
      </Popover>
      <ResetCreditDialog
        open={reset.confirming}
        onOpenChange={reset.setConfirming}
        onConfirm={() => void reset.redeem()}
        disabled={reset.busy || !reset.canManageProviders}
      />
      {reset.status ? (
        <p role="status" className="mt-2 text-xs">
          {uiT(reset.status)}
        </p>
      ) : null}
    </div>
  );
}
