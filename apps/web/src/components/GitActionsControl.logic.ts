import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import type {
  GitRunStackedActionResult,
  GitStackedAction,
  ReviewDiffPreviewSource,
  VcsStatusResult,
} from "@t3tools/contracts";
import { isTemporaryWorktreeBranch } from "@t3tools/shared/git";
import type { ChangeRequestTerminology } from "@t3tools/client-runtime/source-control-clients";
import {
  changeRequestTerminologyFor,
  type DefaultBranchActionDialogCopy,
  type DefaultBranchConfirmableAction,
  type GitActionIconName,
  type GitDialogAction,
} from "@t3tools/client-runtime/state/vcs";

export {
  requiresDefaultBranchConfirmation,
  type DefaultBranchConfirmableAction,
  type GitActionIconName,
} from "@t3tools/client-runtime/state/vcs";

export interface GitActionMenuItem {
  id: "commit" | "push" | "pr";
  label: string;
  disabled: boolean;
  icon: GitActionIconName;
  kind: "open_dialog";
  dialogAction?: GitDialogAction;
}

export interface GitQuickAction {
  label: string;
  disabled: boolean;
  kind: "run_action" | "run_pull" | "open_publish" | "show_hint";
  action?: GitStackedAction;
  hint?: string;
}

export interface GitActionProgressPresentation {
  readonly status: string;
  readonly output: string | null;
  readonly startedAtMs: number | null;
}

export interface GitActionResultToastTiming {
  readonly timeout: 0;
  readonly dismissAfterVisibleMs: number | null;
}

export const GIT_ACTION_SUCCESS_VISIBLE_MS = 10_000;

export function resolveGitActionResultToastTiming(
  type: "error" | "success",
): GitActionResultToastTiming {
  return {
    timeout: 0,
    dismissAfterVisibleMs: type === "success" ? GIT_ACTION_SUCCESS_VISIBLE_MS : null,
  };
}

export function resolveGitActionProgressPresentation(
  input: {
    readonly isRunning: boolean;
    readonly operation: string | null;
    readonly currentLabel: string | null;
    readonly lastOutputLine: string | null;
    readonly phaseStartedAtMs: number | null;
    readonly hookStartedAtMs: number | null;
  },
  translate = createUiTranslator("en"),
): GitActionProgressPresentation | null {
  if (
    !input.isRunning ||
    (input.operation !== "run_change_request" && input.operation !== "pull")
  ) {
    return null;
  }

  const currentLabel = input.currentLabel?.trim();
  const output = input.lastOutputLine?.trim();
  const isPull = input.operation === "pull";
  return {
    status:
      currentLabel && currentLabel !== "Running source control action"
        ? currentLabel
        : isPull
          ? translate("Pulling latest changes...")
          : translate("Starting source control action..."),
    output: !isPull && output ? output : null,
    startedAtMs: isPull
      ? input.phaseStartedAtMs
      : (input.hookStartedAtMs ?? input.phaseStartedAtMs),
  };
}

export function formatGitActionElapsed(startedAtMs: number | null, nowMs: number): string | null {
  if (startedAtMs === null) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1_000));
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`;
  }

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function buildMenuItems(
  gitStatus: VcsStatusResult | null,
  isBusy: boolean,
  hasPrimaryRemote = true,
  translate = createUiTranslator("en"),
): GitActionMenuItem[] {
  if (!gitStatus) return [];
  const terminology = changeRequestTerminologyFor(gitStatus);

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isBehind = gitStatus.behindCount > 0;
  const hasDefaultBranchDelta = (gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) > 0;
  const canPushWithoutUpstream = hasPrimaryRemote && !gitStatus.hasUpstream;
  const canCommit = !isBusy && hasChanges;
  const canPush =
    !isBusy &&
    hasBranch &&
    !isBehind &&
    gitStatus.aheadCount > 0 &&
    (gitStatus.hasUpstream || canPushWithoutUpstream);
  const canCreatePr =
    !isBusy &&
    hasBranch &&
    !hasOpenPr &&
    hasDefaultBranchDelta &&
    !isBehind &&
    (gitStatus.hasUpstream || canPushWithoutUpstream);

  const commitItem: GitActionMenuItem = {
    id: "commit",
    label: translate("Commit"),
    disabled: !canCommit,
    icon: "commit",
    kind: "open_dialog",
    dialogAction: "commit",
  };

  if (!hasPrimaryRemote) {
    return [commitItem];
  }

  const pushItem: GitActionMenuItem = {
    id: "push",
    label: translate("Push"),
    disabled: !canPush,
    icon: "push",
    kind: "open_dialog",
    dialogAction: "push",
  };

  if (hasOpenPr) {
    return [commitItem, pushItem];
  }

  return [
    commitItem,
    pushItem,
    {
      id: "pr",
      label: translate("Create {0}", { "0": translate(terminology.shortLabel) }),
      disabled: !canCreatePr,
      icon: "pr",
      kind: "open_dialog",
      dialogAction: "create_pr",
    },
  ];
}

export function getMenuActionDisabledReason(
  {
    item,
    gitStatus,
    isBusy,
    hasPrimaryRemote,
  }: {
    item: GitActionMenuItem;
    gitStatus: VcsStatusResult | null;
    isBusy: boolean;
    hasPrimaryRemote: boolean;
  },
  translate = createUiTranslator("en"),
): string | null {
  if (!item.disabled) return null;
  if (isBusy) return translate("Git action in progress.");
  if (!gitStatus) return translate("Git status is unavailable.");

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const isAhead = gitStatus.aheadCount > 0;
  const isBehind = gitStatus.behindCount > 0;
  const terminology = changeRequestTerminologyFor(gitStatus);

  if (item.id === "commit") {
    if (!hasChanges) {
      return translate("Worktree is clean. Make changes before committing.");
    }
    return translate("Commit is currently unavailable.");
  }

  if (item.id === "push") {
    if (!hasBranch) {
      return translate("Detached HEAD: check out a branch before pushing.");
    }
    if (isBehind) {
      return translate("Branch is behind upstream. Pull/rebase before pushing.");
    }
    if (!gitStatus.hasUpstream && !hasPrimaryRemote) {
      return translate('Add an "origin" remote before pushing.');
    }
    if (!isAhead) {
      return translate("No local commits to push.");
    }
    return translate("Push is currently unavailable.");
  }

  if (!hasBranch) {
    return translate("Detached HEAD: check out a branch before creating a {0}.", {
      "0": translate(terminology.singular),
    });
  }
  if (!gitStatus.hasUpstream && !hasPrimaryRemote) {
    return translate('Add an "origin" remote before creating a {0}.', {
      "0": translate(terminology.singular),
    });
  }
  if ((gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) <= 0) {
    return translate("No local commits to include in a {0}.", {
      "0": translate(terminology.singular),
    });
  }
  if (isBehind) {
    return translate("Branch is behind upstream. Pull/rebase before creating a {0}.", {
      "0": translate(terminology.singular),
    });
  }
  return translate("Create {0} is currently unavailable.", {
    "0": translate(terminology.singular),
  });
}

export function hasUsableGitMenuContent(input: {
  readonly menuItems: readonly GitActionMenuItem[];
  readonly canWriteSourceControl: boolean;
  readonly canPublishRepository: boolean;
  readonly hasNotice: boolean;
}): boolean {
  return (
    input.canPublishRepository ||
    input.hasNotice ||
    (input.canWriteSourceControl && input.menuItems.some((item) => !item.disabled))
  );
}

export function resolveQuickAction(
  gitStatus: VcsStatusResult | null,
  isBusy: boolean,
  isDefaultRef = false,
  hasPrimaryRemote = true,
  translate = createUiTranslator("en"),
): GitQuickAction {
  if (isBusy) {
    return {
      label: translate("Commit"),
      disabled: true,
      kind: "show_hint",
      hint: translate("Git action in progress."),
    };
  }

  if (!gitStatus) {
    return {
      label: translate("Commit"),
      disabled: true,
      kind: "show_hint",
      hint: translate("Git status is unavailable."),
    };
  }

  const hasBranch = gitStatus.refName !== null;
  const hasChanges = gitStatus.hasWorkingTreeChanges;
  const hasOpenPr = gitStatus.pr?.state === "open";
  const isAhead = gitStatus.aheadCount > 0;
  const hasDefaultBranchDelta = (gitStatus.aheadOfDefaultCount ?? gitStatus.aheadCount) > 0;
  const isBehind = gitStatus.behindCount > 0;
  const isDiverged = isAhead && isBehind;
  const terminology = changeRequestTerminologyFor(gitStatus);

  if (!hasBranch) {
    return {
      label: translate("Commit"),
      disabled: true,
      kind: "show_hint",
      hint: translate("Create and checkout a ref before pushing or opening a {0}.", {
        "0": translate(terminology.singular),
      }),
    };
  }

  if (hasChanges) {
    if (isBehind || (!gitStatus.hasUpstream && !hasPrimaryRemote)) {
      return { label: translate("Commit"), disabled: false, kind: "run_action", action: "commit" };
    }
    if (hasOpenPr || isDefaultRef) {
      return {
        label: translate("Commit & push"),
        disabled: false,
        kind: "run_action",
        action: "commit_push",
      };
    }
    return {
      label: translate("Commit, push & {0}", { "0": translate(terminology.shortLabel) }),
      disabled: false,
      kind: "run_action",
      action: "commit_push_pr",
    };
  }

  if (!gitStatus.hasUpstream) {
    if (!hasPrimaryRemote) {
      return {
        label: translate("Publish repository"),
        disabled: false,
        kind: "open_publish",
      };
    }
    if (!isAhead) {
      if (hasOpenPr) {
        return {
          label: translate("Commit"),
          disabled: true,
          kind: "show_hint",
          hint: translate("Branch is up to date. No action needed."),
        };
      }
      return {
        label: translate("Push"),
        disabled: true,
        kind: "show_hint",
        hint: translate("No local commits to push."),
      };
    }
    if (hasOpenPr || isDefaultRef) {
      return {
        label: translate("Push"),
        disabled: false,
        kind: "run_action",
        action: isDefaultRef ? "commit_push" : "push",
      };
    }
    return {
      label: translate("Push & create {0}", { "0": translate(terminology.shortLabel) }),
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  if (isDiverged) {
    return {
      label: translate("Sync ref"),
      disabled: true,
      kind: "show_hint",
      hint: translate("Branch has diverged from upstream. Rebase/merge first."),
    };
  }

  if (isBehind) {
    return {
      label: translate("Pull"),
      disabled: false,
      kind: "run_pull",
    };
  }

  if (isAhead) {
    if (hasOpenPr || isDefaultRef) {
      return {
        label: translate("Push"),
        disabled: false,
        kind: "run_action",
        action: isDefaultRef ? "commit_push" : "push",
      };
    }
    return {
      label: translate("Push & create {0}", { "0": translate(terminology.shortLabel) }),
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  if (hasOpenPr && gitStatus.hasUpstream) {
    return {
      label: translate("Commit"),
      disabled: true,
      kind: "show_hint",
      hint: translate("Branch is up to date. No action needed."),
    };
  }

  if (hasDefaultBranchDelta && !isDefaultRef) {
    return {
      label: translate("Create {0}", { "0": translate(terminology.shortLabel) }),
      disabled: false,
      kind: "run_action",
      action: "create_pr",
    };
  }

  return {
    label: translate("Commit"),
    disabled: true,
    kind: "show_hint",
    hint: translate("Branch is up to date. No action needed."),
  };
}

export function resolveDefaultBranchActionDialogCopy(
  input: {
    action: DefaultBranchConfirmableAction;
    branchName: string;
    includesCommit: boolean;
    terminology: ChangeRequestTerminology;
  },
  translate = createUiTranslator("en"),
): DefaultBranchActionDialogCopy {
  const branchLabel = input.branchName;
  const { terminology } = input;

  if (input.action === "push" || input.action === "commit_push") {
    if (input.includesCommit) {
      return {
        title: translate("Commit & push to default ref?"),
        description: translate(
          'This action will commit and push changes on "{0}". You can continue on this ref or create a feature ref and run the same action there.',
          { "0": branchLabel },
        ),
        continueLabel: translate("Commit & push to {0}", { "0": branchLabel }),
      };
    }
    return {
      title: translate("Push to default ref?"),
      description: translate(
        'This action will push local commits on "{0}". You can continue on this ref or create a feature ref and run the same action there.',
        { "0": branchLabel },
      ),
      continueLabel: translate("Push to {0}", { "0": branchLabel }),
    };
  }

  if (input.includesCommit) {
    return {
      title: translate("Commit, push & create {0} from default ref?", {
        "0": translate(terminology.shortLabel),
      }),
      description: translate(
        'This action will commit, push, and create a {0} on "{1}". You can continue on this ref or create a feature ref and run the same action there.',
        { "0": translate(terminology.singular), "1": branchLabel },
      ),
      continueLabel: translate("Commit, push & create {0}", {
        "0": translate(terminology.shortLabel),
      }),
    };
  }
  return {
    title: translate("Push & create {0} from default ref?", {
      "0": translate(terminology.shortLabel),
    }),
    description: translate(
      'This action will push local commits and create a {0} on "{1}". You can continue on this ref or create a feature ref and run the same action there.',
      { "0": translate(terminology.singular), "1": branchLabel },
    ),
    continueLabel: translate("Push & create {0}", { "0": translate(terminology.shortLabel) }),
  };
}

/** The server names a feature branch from the commit it makes, so the action must commit changes. */
export function resolveFeatureBranchUnavailableReason(
  input: {
    action: DefaultBranchConfirmableAction;
    branchName: string;
    hasWorkingTreeChanges: boolean;
  },
  translate = createUiTranslator("en"),
): string | null {
  if (!input.hasWorkingTreeChanges) {
    return translate(
      "There are no changes to commit, so a feature branch can't be named. Create a branch yourself or continue on {0}.",
      { "0": input.branchName },
    );
  }
  if (input.action === "push" || input.action === "create_pr") {
    return translate(
      "This action doesn't commit your changes, so a feature branch can't be named. Create a branch yourself or continue on {0}.",
      { "0": input.branchName },
    );
  }
  return null;
}

export function resolveThreadBranchUpdate(
  result: GitRunStackedActionResult,
): { branch: string } | null {
  if (result.branch.status !== "created" || !result.branch.name) {
    return null;
  }

  return {
    branch: result.branch.name,
  };
}

export function resolveThreadBranchMetadataPatch(
  branch: string | null,
  expectedBranch: string | null,
): {
  branch: string | null;
  expectedBranch: string | null;
} {
  return { branch, expectedBranch };
}

export function resolveLiveThreadBranchUpdate(input: {
  threadBranch: string | null;
  gitStatus: VcsStatusResult | null;
}): { branch: string | null } | null {
  if (!input.gitStatus) {
    return null;
  }

  if (input.gitStatus.refName === null && input.threadBranch !== null) {
    return null;
  }

  if (input.threadBranch === input.gitStatus.refName) {
    return null;
  }

  if (
    input.threadBranch !== null &&
    input.gitStatus.refName !== null &&
    !isTemporaryWorktreeBranch(input.threadBranch) &&
    isTemporaryWorktreeBranch(input.gitStatus.refName)
  ) {
    return null;
  }

  return {
    branch: input.gitStatus.refName,
  };
}

export type ChangesLineTotals = {
  readonly insertions: number;
  readonly deletions: number;
  /** Ref the counts compare against; `null` means they are uncommitted changes against HEAD. */
  readonly baseRef: string | null;
};

// `branchChanges ?? workingTree` treats `{0,0}` as present, so a zero branch total hid a dirty
// working tree and the Changes row read +0 while Diff still showed the work.
// The Diff panel's branch comparison wins when it has file stats, so a remembered base or
// hidden whitespace reads the same in the row as in the panel.
export function resolveChangesTotals(
  status: VcsStatusResult | null | undefined,
  branchPreview?: ReviewDiffPreviewSource | null,
): ChangesLineTotals | null {
  if (branchPreview?.files) {
    let insertions = 0;
    let deletions = 0;
    for (const file of branchPreview.files) {
      insertions += file.additions;
      deletions += file.deletions;
    }
    return { insertions, deletions, baseRef: branchPreview.baseRef };
  }
  if (!status) return null;
  const branch = status.branchChanges;
  const tree = { ...status.workingTree, baseRef: null };
  const selected =
    branch && (branch.insertions > 0 || branch.deletions > 0)
      ? branch
      : tree.insertions > 0 || tree.deletions > 0
        ? tree
        : (branch ?? tree);
  return {
    insertions: selected.insertions,
    deletions: selected.deletions,
    baseRef: selected.baseRef,
  };
}
