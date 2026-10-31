import { UiText, useUiLanguage } from "../../i18n";
import * as Dialog from "../../components/ui/Dialog";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import type { PullRequestDetail, PullRequestMergeMethod } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useRef, useState } from "react";
import { View } from "react-native";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { SplitButton } from "../../components/ui/SplitButton";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { composerPullRequests } from "../../state/pull-requests";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  allowedMergeMethods,
  canPerformPullRequestAction,
  mergeUnavailableReason,
  MERGE_CONFLICT_REASON,
  MERGE_METHODS,
  pullRequestActionLabel,
} from "./pullRequestActions";
import { pullRequestStackMerge, singlePullRequestMergeAllowed } from "./pullRequestStack";
import { pullRequestTarget, type PullRequestParams } from "./usePullRequestDiff";
import { usePullRequestPermissions } from "./usePullRequestPermissions";
import { PullRequestGlyph } from "./pullRequestGlyphs";
import type { PullRequestStackState } from "./usePullRequestStack";

export function PullRequestMergeControls(props: {
  readonly pr: PullRequestDetail;
  readonly params: PullRequestParams;
  readonly stack: PullRequestStackState;
}) {
  const { t: uiT } = useUiLanguage();

  const { pr, stack } = props;
  const terminology = sourceControlClients.get(pr.provider).changeRequest;
  const target = pullRequestTarget(props.params);
  const permissions = usePullRequestPermissions(props.params, pr);
  const preferences = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const runAction = useAtomCommand(composerPullRequests.runAction, { reportFailure: false });
  const refreshDetail = useAtomRefresh(composerPullRequests.detail(target));
  const refreshActivity = useAtomRefresh(composerPullRequests.activity(target));
  const [selectedMethod, setSelectedMethod] = useState<PullRequestMergeMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const methods = allowedMergeMethods(pr);
  const preferred =
    selectedMethod ??
    (AsyncResult.isSuccess(preferences) ? preferences.value.pullRequestMergeMethod : undefined) ??
    "squash";
  const method = methods.includes(preferred)
    ? preferred
    : methods.includes("squash")
      ? "squash"
      : methods[0];
  const scope = stack.stack ? pullRequestStackMerge(stack.stack, pr.number, terminology) : null;
  const canMergeSingle = singlePullRequestMergeAllowed({
    supportsStackActions: stack.supportsStackActions,
    hasStack: stack.stack !== null,
    isFresh: stack.isFresh,
  });
  const checkingStack =
    permissions.connected && stack.supportsStackActions && !stack.isFresh && !stack.error;
  const reason = !permissions.connected
    ? uiT("Reconnect to merge.")
    : (mergeUnavailableReason(pr, permissions.canWrite, terminology) ?? stack.stack)
      ? !stack.supportsStackActions
        ? uiT("This environment can display stacks but cannot merge them.")
        : !stack.isFresh
          ? uiT("Refresh the stack before merging.")
          : scope?.reason
      : !canMergeSingle
        ? stack.error
          ? uiT("Couldn't check stack membership. Refresh before merging.")
          : "Checking stack membership…"
        : null;
  const canMerge = !busy && method !== undefined && !reason;
  const label = method
    ? scope && scope.layers.length > 1
      ? uiT("{0} stack ({1})", { "0": MERGE_METHODS[method].title, "1": scope.layers.length })
      : MERGE_METHODS[method].title
    : uiT("Merge unavailable");
  const autoAction = pr.autoMergeEnabled ? "disable-auto-merge" : "enable-auto-merge";
  const canAutoMerge =
    !busy &&
    (autoAction === "disable-auto-merge" || (!stack.stack && canMergeSingle)) &&
    permissions.canWrite &&
    canPerformPullRequestAction(pr, autoAction);

  const perform = async (action: "merge" | "enable-auto-merge" | "disable-auto-merge") => {
    if (
      pending.current ||
      (action !== "disable-auto-merge" && !method) ||
      (action === "merge" ? !canMerge : !canAutoMerge)
    )
      return;
    pending.current = true;
    setBusy(true);
    const response = await runAction({
      ...target,
      input: {
        ...target.input,
        action,
        ...(action === "merge" && method && stack.stack && scope
          ? {
              stackNumber: stack.stack.number,
              expectedStackHeads: scope.heads,
              mergeMethod: method,
            }
          : action === "merge" && method
            ? {
                resolveMergeMethod: (fresh) => {
                  if (
                    !canPerformPullRequestAction(fresh, "merge") ||
                    !allowedMergeMethods(fresh).includes(method)
                  )
                    throw new Error(`The ${terminology.singular} changed. Refresh before merging.`);
                  return method;
                },
              }
            : action === "enable-auto-merge" && method
              ? { mergeMethod: method }
              : {}),
      },
    });
    // A stack can partly merge before the provider reports a failure.
    refreshDetail();
    refreshActivity();
    stack.refresh();
    pending.current = false;
    setBusy(false);
    if (AsyncResult.isFailure(response)) {
      const cause = squashAtomCommandFailure(response);
      Dialog.alert(
        uiT("Couldn't complete the merge action"),
        cause instanceof Error ? cause.message : uiT("Try again."),
      );
    }
  };
  const confirm = (action: "merge" | "enable-auto-merge" | "disable-auto-merge") => {
    const title =
      action === "merge"
        ? scope && scope.layers.length > 1
          ? uiT("Merge {0} stack layers?", { "0": scope.layers.length })
          : `${uiT(pullRequestActionLabel("merge", terminology))}?`
        : action === "enable-auto-merge"
          ? uiT("Enable auto-merge?")
          : uiT("Disable auto-merge?");
    const message =
      action === "merge" && scope
        ? uiT("Merge {0} into {1} using {2}. Layers above #{3} stay open.", {
            "0": scope.layers.map((layer) => `#${layer.number}`).join(" → "),
            "1": stack.stack?.base,
            "2": method,
            "3": pr.number,
          })
        : action === "enable-auto-merge"
          ? uiT(
              "Merge #{0} using {1} when its requirements are met. This may happen immediately.",
              { "0": pr.number, "1": method },
            )
          : action === "disable-auto-merge"
            ? uiT("Stop the provider from automatically merging this {0}.", {
                "0": uiT(terminology.singular),
              })
            : uiT("Merge #{0} into {1} using {2}.", {
                "0": pr.number,
                "1": pr.baseBranch,
                "2": method,
              });
    Dialog.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: action === "merge" ? label : title.replace("?", ""),
        onPress: () => void perform(action),
      },
    ]);
  };
  return (
    <View className="gap-2 border-t border-border-subtle p-3">
      <SplitButton
        label={busy ? uiT("Working…") : !permissions.connected ? uiT("Reconnect to merge") : label}
        accessibilityLabel={
          scope ? `${label}, ${scope.layers.length} stack layers through #${pr.number}` : label
        }
        icon={PullRequestGlyph.merged}
        disabled={!canMerge}
        loading={busy || checkingStack}
        onPress={() => confirm("merge")}
        menuTitle={uiT("Merge options")}
        actions={[
          ...methods.map((id) => ({
            id,
            title: MERGE_METHODS[id].title,
            state: id === method ? ("on" as const) : ("off" as const),
            attributes: { disabled: !canMerge && !canAutoMerge },
          })),
          ...(canAutoMerge
            ? [
                {
                  id: autoAction,
                  title: pr.autoMergeEnabled ? uiT("Disable auto-merge") : uiT("Enable auto-merge"),
                  image: "clock",
                },
              ]
            : []),
        ]}
        onPressAction={(id) => {
          const selected = methods.find((method) => method === id);
          if (selected) {
            setSelectedMethod(selected);
            savePreferences({ pullRequestMergeMethod: selected });
          } else if (id === autoAction && canAutoMerge) confirm(autoAction);
        }}
      />
      {permissions.connected &&
      reason &&
      reason !== MERGE_CONFLICT_REASON &&
      reason !== "Checking stack membership…" &&
      !(checkingStack && reason === "Refresh the stack before merging.") ? (
        <Text className="px-1 text-xs text-foreground-muted">{reason}</Text>
      ) : null}
      {pr.autoMergeEnabled ? (
        <Text className="px-1 text-xs text-foreground-muted">
          <UiText
            message={"Auto-merge is enabled{0}"}
            values={{ "0": pr.autoMergeMethod ? ` · ${pr.autoMergeMethod}` : "" }}
          />
        </Text>
      ) : null}
      {stack.error && stack.supportsStackActions ? (
        <Button label={uiT("Retry stack lookup")} tone="text" onPress={stack.refresh} />
      ) : null}
    </View>
  );
}
