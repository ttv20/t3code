import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { PullRequestDetail, PullRequestMergeMethod } from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useRef, useState } from "react";
import { View } from "react-native";
import type { AppSymbolName } from "../../components/ui/AppSymbol";
import { AppText as Text } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import * as Dialog from "../../components/ui/Dialog";
import { SplitButton } from "../../components/ui/SplitButton";
import { useUiLanguage } from "../../i18n";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { composerPullRequests } from "../../state/pull-requests";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  allowedMergeMethods,
  canPerformPullRequestAction,
  MERGE_METHODS,
  mergeUnavailableReason,
  PR_ACTION_ICONS,
  pullRequestActionLabel,
} from "./pullRequestActions";
import { PullRequestGlyph } from "./pullRequestGlyphs";
import { pullRequestStackMerge, singlePullRequestMergeAllowed } from "./pullRequestStack";
import { usePullRequestAction } from "./usePullRequestAction";
import { pullRequestTarget, type PullRequestParams } from "./usePullRequestDiff";
import { usePullRequestPermissions } from "./usePullRequestPermissions";
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
  const stateAction = usePullRequestAction(props.params, pr);
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
  const nextAction =
    pr.state === "closed" ? "reopen" : pr.state === "open" && pr.isDraft ? "ready" : null;
  // States the button itself names, instead of a reason line under it. Draft and
  // closed offer their way forward when the viewer can take it.
  const status: {
    label: string;
    icon: AppSymbolName;
    final?: boolean;
    action?: "ready" | "reopen";
  } | null =
    nextAction && stateAction.available(nextAction)
      ? {
          label: pullRequestActionLabel(nextAction, terminology),
          icon: PR_ACTION_ICONS[nextAction],
          final: nextAction === "reopen",
          action: nextAction,
        }
      : pr.state === "merged"
        ? { label: uiT("Merged"), icon: PullRequestGlyph.merged, final: true }
        : pr.state === "closed"
          ? { label: uiT("Closed"), icon: PullRequestGlyph.closed, final: true }
          : pr.isDraft
            ? { label: uiT("Draft"), icon: PullRequestGlyph.draft }
            : pr.mergeability === "conflicting"
              ? { label: uiT("Resolve conflicts to merge"), icon: PullRequestGlyph.conflicting }
              : pr.autoMergeEnabled
                ? {
                    label: uiT("Auto-merge pending{0}", {
                      "0": pr.autoMergeMethod ? ` (${pr.autoMergeMethod})` : "",
                    }),
                    icon: "clock",
                  }
                : checkingStack && !busy
                  ? { label: uiT("Checking stack…"), icon: PullRequestGlyph.merged }
                  : null;
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
    if (!AsyncResult.isSuccess(response)) refreshDetail();
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
        label={
          busy || stateAction.busy
            ? uiT("Working…")
            : !permissions.connected
              ? uiT("Reconnect to merge")
              : (status?.label ?? label)
        }
        accessibilityLabel={
          status
            ? status.label
            : scope
              ? uiT("{0}, {1} stack layers through #{2}", {
                  "0": label,
                  "1": scope.layers.length,
                  "2": pr.number,
                })
              : label
        }
        icon={status?.icon ?? PullRequestGlyph.merged}
        disabled={status?.action ? stateAction.busy : !canMerge || status !== null}
        loading={busy || stateAction.busy || (!status?.action && checkingStack)}
        onPress={() =>
          status?.action ? void stateAction.perform(status.action) : confirm("merge")
        }
        menuTitle="Merge options"
        actions={
          status?.final
            ? []
            : [
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
                        title: pr.autoMergeEnabled
                          ? uiT("Disable auto-merge")
                          : uiT("Enable auto-merge"),
                        image: "clock",
                      },
                    ]
                  : []),
              ]
        }
        onPressAction={(id) => {
          const selected = methods.find((method) => method === id);
          if (selected) {
            setSelectedMethod(selected);
            savePreferences({ pullRequestMergeMethod: selected });
          } else if (id === autoAction && canAutoMerge) confirm(autoAction);
        }}
      />
      {permissions.connected && !status && reason ? (
        <Text className="px-1 text-xs text-foreground-muted">{reason}</Text>
      ) : null}
      {stack.error && stack.supportsStackActions ? (
        <Button label={uiT("Retry stack lookup")} tone="text" onPress={stack.refresh} />
      ) : null}
    </View>
  );
}
