import { useUiLanguage } from "../i18n";
import { useAtomValue } from "@effect/atom-react";
import {
  AuthEnvironmentMaintainScope,
  type AuthSessionState,
  sessionGrantsScope,
} from "@t3tools/contracts";
import type { AsyncResult } from "effect/reactivity";
import { environmentSession } from "~/state/session";
import type {
  EnvironmentId,
  ServerInstallation,
  ServerSelfUpdateCapability,
} from "@t3tools/contracts";
import type { ServerUpdateStage, ServerUpdateState } from "@t3tools/client-runtime/state/server";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { CircleArrowUpIcon } from "lucide-react";
import { type ComponentProps, useRef, useState } from "react";

import { requestConfirmDialog } from "~/confirmDialog";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { useEnvironmentSettings } from "~/hooks/useSettings";
import { serverEnvironment, updateOutdatedServer } from "~/state/server";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useAtomCommand } from "~/state/use-atom-command";
import { manualServerUpdateCommand } from "~/versionSkew";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

// The wire "installing" stage is a sub-second launcher handoff, so the UI
// folds it into the download phase; everything after the handoff is the
// restart the user is actually waiting through.
const UPDATE_STAGE_LABELS: Record<ServerUpdateStage, string> = {
  downloading: "Downloading…",
  installing: "Downloading…",
  resuming: "Restarting…",
};
const pendingUpdateEnvironmentIds = new Set<EnvironmentId>();

export function serverUpdateStageLabel(stage: ServerUpdateStage): string {
  return UPDATE_STAGE_LABELS[stage];
}

function updateFailureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Server update failed.";
}

function serverUpdateMethodLabel(capability: ServerSelfUpdateCapability | null): string {
  if (capability === "desktop-managed") return "desktop updater, using its own release feed";
  if (capability === "boot-service") return "existing standalone installation";
  return "existing server updater";
}

export interface ServerUpdateTarget {
  readonly environmentId: EnvironmentId;
  readonly serverLabel: string;
  readonly selfUpdate: ServerSelfUpdateCapability | null;
  readonly installation?: ServerInstallation | undefined;
  readonly desktopAppUpdate?: boolean;
  readonly threadContinuation?: boolean;
  readonly targetVersion: string;
  readonly currentVersion?: string;
  readonly continueThreadsAfterServerUpdate?: boolean;
}

type UpdateButtonProps = Pick<ComponentProps<typeof Button>, "variant" | "size" | "className"> & {
  readonly label?: string;
  readonly confirmRestart?: boolean;
  /** "icon" renders a compact icon button with the label in a tooltip. */
  readonly appearance?: "button" | "icon";
};

/** What {@link useServerUpdate} did. "skipped" covers a missing permission, an
    update already in flight, and an interrupted request. */
export type ServerUpdateOutcome =
  | { readonly status: "updated" | "skipped" }
  | { readonly status: "failed"; readonly message: string };

/** Updates one server and waits until it is back on the target version.
    Toasts its success or failure unless `quiet`; never rejects. */
export function useServerUpdate() {
  const { t: uiT } = useUiLanguage();
  const updateServer = useAtomCommand(serverEnvironment.updateServer, { reportFailure: false });
  return async (
    target: ServerUpdateTarget,
    { quiet = false }: { readonly quiet?: boolean } = {},
  ): Promise<ServerUpdateOutcome> => {
    const { environmentId, serverLabel, selfUpdate, targetVersion } = target;
    if (
      !canUpdateServer(appAtomRegistry.get(environmentSession.sessionStateAtom(environmentId))) ||
      pendingUpdateEnvironmentIds.has(environmentId)
    )
      return { status: "skipped" };
    pendingUpdateEnvironmentIds.add(environmentId);
    try {
      const result = await updateServer({
        environmentId,
        input: {
          targetVersion,
          ...(target.threadContinuation && target.continueThreadsAfterServerUpdate
            ? { continueRunningThreads: true }
            : {}),
        },
      });
      if (result._tag === "Failure") {
        if (isAtomCommandInterrupted(result)) return { status: "skipped" };
        throw squashAtomCommandFailure(result);
      }
      if (!quiet) {
        toastManager.add({
          type: "success",
          title: uiT("{0} updated", { "0": serverLabel }),
          description:
            selfUpdate === "desktop-managed"
              ? uiT("Desktop app relaunched on {0}.", { "0": result.value.targetVersion })
              : uiT("Reconnected on t3@{0}.", { "0": result.value.targetVersion }),
        });
      }
      return { status: "updated" };
    } catch (error) {
      const message = updateFailureMessage(error);
      if (!quiet) {
        toastManager.add({
          type: "error",
          title: uiT("{0} update failed", { "0": serverLabel }),
          description: message,
        });
      }
      return { status: "failed", message };
    } finally {
      pendingUpdateEnvironmentIds.delete(environmentId);
    }
  };
}

/** Updates eligible machines independently; manual paths remain in the machine list. */
export function ServerUpdatesAction({
  targets,
  label = "Update all",
  variant = "outline",
  size = "xs",
  className,
  confirmRestart = false,
}: UpdateButtonProps & {
  readonly targets: ReadonlyArray<ServerUpdateTarget>;
}) {
  const { t: uiT } = useUiLanguage();
  const update = useServerUpdate();
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const eligible = targets.filter(
    (target) =>
      target.selfUpdate !== null &&
      (target.selfUpdate !== "desktop-managed" || target.desktopAppUpdate),
  );
  const handleUpdate = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsPending(true);
    try {
      const available = eligible.filter(
        (target) => !pendingUpdateEnvironmentIds.has(target.environmentId),
      );
      if (available.length === 0) return;
      const desktopTargets = available.filter((target) => target.selfUpdate === "desktop-managed");
      if (confirmRestart || desktopTargets.length > 0) {
        const confirmation = requestConfirmDialog(
          confirmRestart
            ? `Update T3 Code on these machines?\n\n${available.map((target) => `${target.serverLabel}: ${target.selfUpdate === "desktop-managed" ? serverUpdateMethodLabel(target.selfUpdate) : `${target.targetVersion} via the ${serverUpdateMethodLabel(target.selfUpdate)}`}`).join("\n")}\n\nOnly T3 Code is updated, not provider CLIs. These servers or desktop apps will restart, potentially interrupting active agents and terminals.`
            : `Update the T3 Code desktop apps on ${desktopTargets.map((target) => target.serverLabel).join(", ")}? They will close and relaunch on those machines.`,
        );
        const confirmed = (await confirmation) ?? !confirmRestart;
        if (!confirmed) return;
      }
      await Promise.all(available.map((target) => update(target)));
    } finally {
      pending.current = false;
      setIsPending(false);
    }
  };
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={isPending || eligible.length === 0}
      onClick={() => void handleUpdate()}
    >
      {uiT(label)}
    </Button>
  );
}

export function canUpdateServer(
  result: AsyncResult.AsyncResult<AuthSessionState, unknown>,
): boolean {
  if (result._tag !== "Success" || !result.value.authenticated) return false;
  return sessionGrantsScope(result.value, AuthEnvironmentMaintainScope);
}

/**
 * One-row status for an in-flight server update: "Downloading…" then
 * "Restarting…". The update is a wait, not a warning: a single static dot
 * and label, no step rail, no versions. Failure turns the row red with the
 * rollback reason.
 */
export function ServerUpdateProgress({
  state,
}: {
  readonly state: Exclude<ServerUpdateState, { status: "idle" }>;
}) {
  if (state.status === "failed") {
    return (
      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-destructive" role="alert">
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
        <Tooltip>
          <TooltipTrigger render={<span className="min-w-0 truncate">{state.message}</span>} />
          <TooltipPopup side="top">{state.message}</TooltipPopup>
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
      <span>{serverUpdateStageLabel(state.stage)}</span>
    </div>
  );
}

/**
 * Offers the update path advertised by a version-skewed server. Self-updates
 * delegate their full lifecycle to client-runtime so this component can
 * unmount during reconnect without losing operation state.
 */
export function ServerUpdateAction({
  environmentId,
  serverLabel,
  selfUpdate,
  installation,
  desktopAppUpdate = false,
  threadContinuation = false,
  targetVersion,
  currentVersion,
  label = "Update",
  variant = "outline",
  size = "xs",
  className,
  appearance = "button",
  confirmRestart = false,
}: Omit<ServerUpdateTarget, "continueThreadsAfterServerUpdate"> & UpdateButtonProps) {
  const { t: uiT } = useUiLanguage();
  const isDesktopAppUpdate = selfUpdate === "desktop-managed";
  const sessionStateAtom = environmentSession.sessionStateAtom(environmentId);
  const canUpdate = canUpdateServer(useAtomValue(sessionStateAtom));
  const continueThreadsAfterServerUpdate = useEnvironmentSettings(
    environmentId,
    (settings) => settings.continueThreadsAfterServerUpdate,
  );
  const update = useServerUpdate();
  const { copyToClipboard } = useCopyToClipboard<{ command: string }>({
    target: installation?.kind === "npm-global" ? "update command" : "relaunch command",
    onCopy: ({ command }) => {
      toastManager.add({
        type: "success",
        title:
          installation?.kind === "npm-global"
            ? uiT("Update command copied")
            : uiT("Relaunch command copied"),
        description:
          installation?.kind === "npm-global"
            ? uiT("Run `{0}` on {1}, then restart t3 with your usual options.", {
                "0": command,
                "1": serverLabel,
              })
            : uiT(
                "Stop t3 on {0}, then relaunch with `{1}` using the same subcommand and options. This does not update an installed t3 command.",
                { "0": serverLabel, "1": command },
              ),
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: uiT("Could not copy update command"),
        description: error.message,
      });
    },
  });

  const handleUpdate = async () => {
    if (
      !canUpdateServer(appAtomRegistry.get(sessionStateAtom)) ||
      pendingUpdateEnvironmentIds.has(environmentId)
    ) {
      return;
    }
    if (isDesktopAppUpdate || confirmRestart) {
      // Settings updates require the popup to be shown. Retain the legacy
      // desktop fallback for callers that do not request confirmation.
      const confirmation = requestConfirmDialog(
        isDesktopAppUpdate
          ? `Update T3 Code on ${serverLabel} using its desktop updater? Its own release feed selects the version. The desktop app will close and relaunch on that machine. Provider CLIs are not updated.`
          : `Update T3 Code on ${serverLabel}${currentVersion ? ` from ${currentVersion}` : ""} to ${targetVersion} using the ${serverUpdateMethodLabel(selfUpdate)}? The server will restart, briefly disconnecting clients and potentially interrupting active agents and terminals. Provider CLIs are not updated.`,
      );
      const confirmed = (await confirmation) ?? !confirmRestart;
      if (!confirmed) {
        return;
      }
    }
    if (!canUpdateServer(appAtomRegistry.get(sessionStateAtom))) return;
    await update({
      environmentId,
      serverLabel,
      selfUpdate,
      desktopAppUpdate,
      threadContinuation,
      targetVersion,
      continueThreadsAfterServerUpdate,
    });
  };

  if (selfUpdate === "desktop-managed" && !desktopAppUpdate) {
    return (
      <span className="text-muted-foreground text-xs">
        {uiT("Update the desktop app on that machine to update this server.")}
      </span>
    );
  }

  const manualCommand =
    selfUpdate === null ? manualServerUpdateCommand(targetVersion, installation) : null;
  const actionLabel =
    manualCommand !== null
      ? installation?.kind === "npm-global"
        ? "Copy update command"
        : "Copy relaunch command"
      : label;
  const onClick =
    manualCommand !== null
      ? () => copyToClipboard(manualCommand, { command: manualCommand })
      : () => void handleUpdate();

  if (appearance === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-xs"
              variant="ghost-muted"
              className={className}
              aria-label={uiT("{0} for {1}", { "0": actionLabel, "1": serverLabel })}
              disabled={manualCommand === null && !canUpdate}
              onClick={onClick}
            />
          }
        >
          <CircleArrowUpIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup side="top">{actionLabel}</TooltipPopup>
      </Tooltip>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={manualCommand === null && !canUpdate}
      onClick={onClick}
    >
      {actionLabel}
    </Button>
  );
}

/**
 * Updates a host too old for this client to connect to. Its version comes
 * from the host descriptor because the host never delivers a server config.
 */
export function OutdatedServerUpdateAction({
  environmentId,
  serverLabel,
  fromVersion,
  targetVersion,
  label = "Update",
}: {
  readonly environmentId: EnvironmentId;
  readonly serverLabel: string;
  readonly fromVersion: string | undefined;
  readonly targetVersion: string;
  readonly label?: string;
}) {
  const { t: uiT } = useUiLanguage();
  const update = useAtomCommand(updateOutdatedServer, { reportFailure: false });
  const handleUpdate = async () => {
    if (pendingUpdateEnvironmentIds.has(environmentId)) return;
    pendingUpdateEnvironmentIds.add(environmentId);
    try {
      const result = await update({
        environmentId,
        input: { targetVersion },
        ...(fromVersion === undefined ? {} : { fromVersion }),
      });
      if (result._tag === "Failure") {
        if (isAtomCommandInterrupted(result)) return;
        throw squashAtomCommandFailure(result);
      }
      toastManager.add({
        type: "success",
        title: uiT("{0} updated", { "0": serverLabel }),
        description: uiT("Reconnected on t3@{0}.", { "0": result.value.targetVersion }),
      });
    } catch (error) {
      toastManager.add({
        type: "error",
        title: uiT("{0} update failed", { "0": serverLabel }),
        description: updateFailureMessage(error),
      });
    } finally {
      pendingUpdateEnvironmentIds.delete(environmentId);
    }
  };
  return (
    <Button size="xs" variant="outline" onClick={() => void handleUpdate()}>
      {uiT(label)}
    </Button>
  );
}
