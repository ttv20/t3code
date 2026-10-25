import { useAtomValue } from "@effect/atom-react";
import { useIsFocused } from "@react-navigation/native";
import { resolveComposerUsageWindows } from "@t3tools/client-runtime/composer-usage-indicator";
import {
  deriveLatestContextWindowSnapshot,
  formatContextWindowTokens,
  latestProviderTurnTokenUsage,
} from "@t3tools/client-runtime/context-window";
import {
  formatUiUsageReset,
  formatUiUsageWindowLabel,
} from "@t3tools/client-runtime/usage-localization";
import type { EnvironmentId, ServerProvider, ThreadId } from "@t3tools/contracts";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import * as Dialog from "../../components/ui/Dialog";
import { useUiLanguage } from "../../i18n";
import { environmentThreadDetails } from "../../state/threads";
import { useRefreshLimits } from "../usage/UsageLimitsSection";
import { useVisibleSecondClock } from "./use-visible-second-clock";

function UsageBar({ label, percent }: { readonly label: string; readonly percent: number }) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}
      className="h-1 w-10 overflow-hidden rounded-full bg-subtle-strong"
    >
      <View
        className={value > 80 ? "h-full bg-red-500" : "h-full bg-primary"}
        style={{ width: `${value}%` }}
      />
    </View>
  );
}

export function ComposerStatus(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId;
  readonly provider: ServerProvider | null;
  readonly connected: boolean;
  readonly hidden: boolean;
  readonly onShowUsageLimits: () => void;
}) {
  const { t: uiT, locale } = useUiLanguage();
  const focused = useIsFocused();
  const projection = useAtomValue(environmentThreadDetails.quietThreadAtom(props))?.projection;
  const context = useMemo(() => {
    if (!projection) return null;
    const providerThread = projection.providerThreads.find(
      (thread) => thread.id === projection.thread.activeProviderThreadId,
    );
    return deriveLatestContextWindowSnapshot(
      projection.visibleTurnItems,
      latestProviderTurnTokenUsage(projection.providerTurns, projection, providerThread),
      providerThread,
    );
  }, [projection]);
  const usage = resolveComposerUsageWindows(props.provider);
  const environments = useMemo(() => new Set([props.environmentId]), [props.environmentId]);
  const refresh = useRefreshLimits(
    environments,
    usage !== null && focused && !props.hidden && props.connected,
  );
  const now = useVisibleSecondClock(usage !== null && !props.hidden, 60_000);
  const windows = [usage?.session, usage?.weekly].filter((window) => window != null);
  if (context === null && windows.length === 0) return null;

  return (
    <View className="flex-row flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 pt-2 pb-1">
      {context !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiT("Context window")}
          onPress={() =>
            Dialog.alert(
              uiT("Context window"),
              context.maxTokens == null
                ? uiT("{0} tokens used", { "0": formatContextWindowTokens(context.usedTokens) })
                : uiT("{0} of {1} tokens used", {
                    "0": formatContextWindowTokens(context.usedTokens),
                    "1": formatContextWindowTokens(context.maxTokens ?? null),
                  }),
            )
          }
          className="min-w-[96px] flex-row items-center gap-2 py-1 active:opacity-60"
        >
          <Text className="text-2xs text-foreground-muted">{uiT("Context")}</Text>
          {context.usedPercentage !== null ? (
            <View className="w-10">
              <UsageBar label={uiT("Context window")} percent={context.usedPercentage} />
            </View>
          ) : null}
          <Text className="text-2xs tabular-nums text-foreground-muted">
            {context.usedPercentage === null
              ? formatContextWindowTokens(context.usedTokens)
              : `${Math.round(context.usedPercentage)}%`}
          </Text>
        </Pressable>
      ) : null}
      <View className="gap-1">
        {windows.map((window) => {
          const label =
            window.windowDurationMins === 300
              ? "5h"
              : window.windowDurationMins === 10_080
                ? "7d"
                : formatUiUsageWindowLabel(window.label, locale);
          const reset = formatUiUsageReset(window, now, locale, true);
          return (
            <Pressable
              key={window.id}
              accessibilityRole="button"
              accessibilityLabel={`${label}, ${Math.round(window.usedPercent)}%, ${reset ?? ""}`}
              onPress={props.onShowUsageLimits}
              className="flex-row items-center gap-1 py-0.5 active:opacity-60"
            >
              <Text className="text-3xs text-foreground-muted">{label}</Text>
              <UsageBar
                label={formatUiUsageWindowLabel(window.label, locale)}
                percent={window.usedPercent}
              />
              <Text className="text-3xs tabular-nums text-foreground-muted">
                {Math.round(window.usedPercent)}%
              </Text>
              {reset ? <Text className="text-3xs text-foreground-muted">{reset}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {windows.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiT("Refresh usage limits")}
          accessibilityState={{ disabled: refresh.refreshing }}
          disabled={!props.connected || refresh.refreshing}
          onPress={() => void refresh.refresh()}
          hitSlop={8}
          className="py-1 active:opacity-60"
        >
          <SymbolView name="arrow.clockwise" size={12} tintColorClassName="accent-icon-muted" />
        </Pressable>
      ) : null}
    </View>
  );
}
