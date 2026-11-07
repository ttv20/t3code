import { useNavigation } from "@react-navigation/native";
import { sourceControlClients } from "@t3tools/client-runtime/source-control-clients";
import {
  type GitActionRequestInput,
  requiresDefaultBranchConfirmation,
  resolveQuickAction,
} from "@t3tools/client-runtime/state/vcs";
import {
  AuthSourceControlWriteScope,
  EnvironmentId,
  type GitRunStackedActionResult,
  type ProjectScript,
  ThreadId,
  type VcsStatusResult,
} from "@t3tools/contracts";
import type { AppBarMenu } from "../../components/ui/AppBar.types";
import * as Dialog from "../../components/ui/Dialog";
import { useUiLanguage } from "../../i18n";
import { useOpenPullRequest } from "../../native/useOpenPullRequest";
import { readUiTranslator } from "../../state/ui-language";

import { projectScriptMenuLabel } from "@t3tools/shared/projectScripts";
import { useEnvironmentScope } from "../../state/session";
import { PullRequestGlyph } from "../pull-requests/pullRequestGlyphs";
import {
  basename,
  getTerminalStatusLabel,
  projectScriptMenuIcon,
  type TerminalMenuSession,
} from "../terminal/terminalMenu";

function truncateMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const headLength = Math.ceil((maxLength - 1) / 2);
  const tailLength = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, headLength)}…${value.slice(value.length - tailLength)}`;
}

function compactMenuBranchLabel(branch: string): string {
  return truncateMiddle(branch, 24);
}

function compactMenuStatus(gitStatus: VcsStatusResult | null): string {
  const uiT = readUiTranslator();
  if (!gitStatus) {
    return uiT("Checking status");
  }
  if (!gitStatus.isRepo) {
    return uiT("Not a repo");
  }

  const parts: string[] = [];
  if (gitStatus.hasWorkingTreeChanges) {
    parts.push(uiT("{0} changed", { "0": gitStatus.workingTree.files.length }));
  } else if (gitStatus.aheadCount === 0 && gitStatus.behindCount === 0) {
    parts.push(uiT("Clean"));
  }
  if (gitStatus.aheadCount > 0) {
    parts.push(uiT("{0} ahead", { "0": gitStatus.aheadCount }));
  }
  if (gitStatus.behindCount > 0) {
    parts.push(uiT("{0} behind", { "0": gitStatus.behindCount }));
  }
  if (gitStatus.pr?.state === "open") {
    const { shortLabel } = sourceControlClients.get(
      gitStatus.sourceControlProvider?.kind,
    ).changeRequest;
    parts.push(`${shortLabel} #${gitStatus.pr.number}`);
  }

  return parts.join(" · ");
}

type QuickActionIcon =
  | "arrow.down.circle"
  | "arrow.up.right.circle"
  | "checkmark.circle"
  | "arrow.up.circle";

export type ThreadGitMenuProps = {
  readonly environmentId: EnvironmentId | string;
  readonly threadId: ThreadId | string;
  readonly currentBranch: string | null;
  readonly hasThread?: boolean;
  readonly gitStatus: VcsStatusResult | null;
  readonly gitOperationLabel: string | null;
  readonly onOpenFilesInspector?: () => void;
  readonly onOpenGitInspector?: () => void;
  readonly onMergeBack?: () => void;
  readonly onPull: () => Promise<void>;
  readonly onRunAction: (input: GitActionRequestInput) => Promise<GitRunStackedActionResult | null>;
};

export type ThreadGitControlsProps = ThreadGitMenuProps & {
  readonly canOpenTerminal: boolean;
  readonly canOperateTerminal: boolean;
  readonly canOpenFiles: boolean;
  readonly projectScripts: ReadonlyArray<ProjectScript>;
  readonly terminalSessions: ReadonlyArray<TerminalMenuSession>;
  readonly onOpenTerminal: (terminalId?: string | null) => void;
  readonly onOpenNewTerminal: () => void;
  readonly onRunProjectScript: (script: ProjectScript) => Promise<void>;
};

function useThreadGitControlModel(props: ThreadGitMenuProps) {
  const { t: uiT } = useUiLanguage();

  const navigation = useNavigation();
  const openPullRequest = useOpenPullRequest();
  const environmentId = props.environmentId;
  const canWriteSourceControl = useEnvironmentScope(
    environmentId ? EnvironmentId.make(String(environmentId)) : null,
    AuthSourceControlWriteScope,
  );
  const threadId = props.threadId;
  const { gitStatus, gitOperationLabel, onPull, onRunAction } = props;

  const currentBranchLabel = gitStatus?.refName ?? props.currentBranch ?? uiT("Detached HEAD");
  const busy = gitOperationLabel !== null;
  const isRepo = gitStatus?.isRepo ?? true;
  const hasPrimaryRemote = gitStatus?.hasPrimaryRemote ?? false;
  const isDefaultRef = gitStatus?.isDefaultRef ?? false;

  const quickAction = (() => {
    if (!isRepo) {
      return {
        label: uiT("Git unavailable"),
        disabled: true,
        kind: "show_hint" as const,
        hint: uiT("This workspace is not a git repository."),
      };
    }
    const action = resolveQuickAction(gitStatus, busy, isDefaultRef, hasPrimaryRemote);
    return !canWriteSourceControl && (action.kind === "run_pull" || action.kind === "run_action")
      ? {
          ...action,
          disabled: true,
          hint: uiT("This connection cannot change source control."),
        }
      : action;
  })();

  const quickActionHint = quickAction.disabled
    ? (quickAction.hint ?? uiT("This action is unavailable."))
    : null;

  const quickActionIcon: QuickActionIcon = (() => {
    if (quickAction.kind === "run_pull") return "arrow.down.circle";
    if (quickAction.kind === "open_pr") return "arrow.up.right.circle";
    if (quickAction.kind === "run_action") {
      if (quickAction.action === "commit") return "checkmark.circle";
      if (quickAction.action === "push" || quickAction.action === "commit_push")
        return "arrow.up.circle";
    }
    return "arrow.up.right.circle";
  })();

  const openExistingPr = async () => {
    const { shortLabel, singular } = sourceControlClients.get(
      gitStatus?.sourceControlProvider?.kind,
    ).changeRequest;
    const prUrl = gitStatus?.pr?.state === "open" ? gitStatus.pr.url : null;
    if (!prUrl) {
      Dialog.alert(
        uiT("No open {0}", { "0": uiT(shortLabel) }),
        uiT("This branch does not have an open {0}.", { "0": uiT(singular) }),
      );
      return;
    }
    if (!(await openPullRequest(prUrl))) {
      Dialog.alert(
        uiT("Unable to open {0}", { "0": uiT(shortLabel) }),
        uiT("The {0} could not be opened.", { "0": uiT(singular) }),
      );
    }
  };

  const runActionWithPrompt = async (input: GitActionRequestInput) => {
    if (!canWriteSourceControl) return;
    const confirmableAction =
      input.action === "push" ||
      input.action === "create_pr" ||
      input.action === "commit_push" ||
      input.action === "commit_push_pr"
        ? input.action
        : null;
    const branchName = gitStatus?.refName;
    if (
      branchName &&
      confirmableAction &&
      !input.featureBranch &&
      requiresDefaultBranchConfirmation(input.action, isDefaultRef)
    ) {
      if (props.hasThread === false) {
        Dialog.alert(
          uiT("Choose a feature branch"),
          uiT("Switch branches before publishing changes from this draft."),
        );
        return;
      }
      navigation.navigate("GitConfirm", {
        environmentId: String(environmentId),
        threadId: String(threadId),
        confirmAction: confirmableAction,
        branchName,
        includesCommit: String(input.action === "commit_push" || input.action === "commit_push_pr"),
      });
      return;
    }

    await onRunAction(input);
  };

  const runQuickAction = async () => {
    if (quickAction.disabled) return;
    if (quickAction.kind === "open_pr") {
      await openExistingPr();
      return;
    }
    if (quickAction.kind === "run_pull") {
      await onPull();
      return;
    }
    if (quickAction.kind === "run_action" && quickAction.action) {
      await runActionWithPrompt({ action: quickAction.action });
    }
  };

  const openReview = () => {
    navigation.navigate("ThreadReview", {
      environmentId: EnvironmentId.make(String(environmentId)),
      threadId: ThreadId.make(String(threadId)),
    });
  };

  const openGitInspector = () => {
    if (props.onOpenGitInspector) {
      props.onOpenGitInspector();
      return;
    }
    navigation.navigate("GitOverview", {
      environmentId: String(environmentId),
      threadId: String(threadId),
    });
  };

  return {
    currentBranchLabel,
    isRepo,
    openGitInspector,
    openReview,
    quickAction,
    quickActionHint,
    quickActionIcon,
    runQuickAction,
  };
}

export function threadTerminalMenu(props: ThreadGitControlsProps): AppBarMenu | null {
  const uiT = readUiTranslator();

  if (!props.canOpenTerminal) return null;
  return {
    title: uiT("Terminal"),
    icon: "terminal",
    separateBackground: false,
    items: [
      ...(props.projectScripts.length > 0
        ? props.projectScripts.map((script) => ({
            id: `script-${script.id}`,
            title: projectScriptMenuLabel(script),
            icon: projectScriptMenuIcon(script.icon),
            subtitle: script.command,
            disabled: !props.canOperateTerminal,
            onPress: () => void props.onRunProjectScript(script),
          }))
        : [
            {
              id: "script-none",
              title: uiT("No project scripts"),
              icon: "play",
              subtitle: uiT("This project has no saved scripts yet"),
              disabled: true,
              onPress: () => {},
            },
          ]),
      ...props.terminalSessions.map((session) => ({
        id: `terminal-${session.terminalId}`,
        title: session.displayLabel,
        icon: "terminal",
        subtitle: [
          uiT(
            getTerminalStatusLabel({
              status: session.status,
              hasRunningSubprocess: session.hasRunningSubprocess,
            }),
          ),
          basename(session.cwd),
        ]
          .filter(Boolean)
          .join(" · "),
        onPress: () => props.onOpenTerminal(session.terminalId),
      })),
      {
        id: "terminal-new",
        title: uiT("Open new terminal"),
        icon: "plus",
        subtitle: uiT("Start another shell for this thread"),
        disabled: !props.canOperateTerminal,
        onPress: props.onOpenNewTerminal,
      },
    ],
  };
}

/** The thread's git menu, shared by the thread bar and Review. */
export function useThreadGitMenuDefinition(props: ThreadGitMenuProps): AppBarMenu | null {
  const { t: uiT } = useUiLanguage();

  const model = useThreadGitControlModel(props);
  return {
    title: uiT("Git controls"),
    icon: "point.topleft.down.curvedto.point.bottomright.up",
    separateBackground: false,
    items: [
      {
        id: "git-status",
        title: compactMenuBranchLabel(model.currentBranchLabel),
        icon: "point.topleft.down.curvedto.point.bottomright.up",
        disabled: true,
        subtitle: compactMenuStatus(props.gitStatus),
        onPress: () => {},
      },
      {
        id: "git-quick-action",
        title: model.quickAction.label,
        icon: model.quickActionIcon,
        disabled: model.quickAction.disabled,
        subtitle: model.quickActionHint ?? undefined,
        onPress: () => {
          void model.runQuickAction();
        },
      },
      {
        id: "git-review",
        title: uiT("Review changes"),
        icon: "text.bubble",
        disabled: !model.isRepo || props.hasThread === false,
        subtitle:
          props.hasThread === false
            ? uiT("Available after the first message")
            : uiT("Turn diffs and worktree changes"),
        onPress: model.openReview,
      },
      ...(props.onMergeBack
        ? [
            {
              id: "git-merge-back",
              title: uiT("Merge back to source"),
              icon: PullRequestGlyph.merged,
              subtitle: uiT("Bring this thread's latest turn into its source"),
              onPress: props.onMergeBack,
            },
          ]
        : []),
      {
        id: "git-more",
        title: uiT("More"),
        icon: "ellipsis",
        disabled: props.hasThread === false,
        subtitle:
          props.hasThread === false
            ? uiT("Available after the first message")
            : uiT("Commit, files, branches"),
        onPress: model.openGitInspector,
      },
    ],
  };
}
