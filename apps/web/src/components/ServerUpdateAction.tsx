import {
  environmentUpdateTarget,
  findEnvironmentUpdate,
} from "@t3tools/client-runtime/environment-updates";
import { resolveServerSelfUpdateCapability, supportsDesktopAppUpdate } from "~/versionSkew";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import { useAtomValue } from "@effect/atom-react";
import {
  AuthEnvironmentMaintainScope,
  type AuthSessionState,
  sessionGrantsScope,
} from "@t3tools/contracts";
import { managedUpdatesDenial } from "@t3tools/client-runtime/contract-labels";
import type { AsyncResult } from "effect/reactivity";
import { environmentSession } from "~/state/session";
import type {
  DesktopUpdateChannel,
  EnvironmentId,
  ServerInstallation,
  ServerSelfUpdateCapability,
} from "@t3tools/contracts";
import {
  serverUpdateFailureText,
  type ServerUpdateStage,
  type ServerUpdateState,
} from "@t3tools/client-runtime/state/server";
import {
  isAtomCommandInterrupted,
  settlePromise,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { CircleArrowUpIcon, RefreshCwIcon } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { msg, T, useGT, useMessages } from "gt-react";
import { m, type MessageResolver } from "../i18n/messages";

import { requestConfirmDialog } from "~/confirmDialog";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { serverEnvironment, updateOutdatedServer } from "~/state/server";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useAtomCommand } from "~/state/use-atom-command";
import { useServerConfigs } from "~/state/entities";
import { useManagedPolicy } from "~/state/managedPolicy";
import { environmentPresentations } from "~/state/presentation";
import { ManagedControl } from "./ManagedPolicy";
import { manualServerUpdateCommand } from "~/versionSkew";
import { crossesReleaseTrack } from "@t3tools/shared/cliRelease";
import { Button } from "./ui/button";
import { toastManager } from "./ui/toast";
import { SharedTooltipTrigger } from "./ui/shared-tooltip";

const UPDATE_STAGE_LABELS: Record<ServerUpdateStage, string> = {
  downloading: msg("Downloading…"),
  installing: msg("Downloading…"),
  resuming: msg("Restarting…"),
};
const pendingUpdateEnvironmentIds = new Set<EnvironmentId>();

export function serverUpdateStageLabel(
  stage: ServerUpdateStage,
  resolve: MessageResolver = m,
): string {
  return resolve(UPDATE_STAGE_LABELS[stage]);
}

/** Why the environment's policy refuses server updates, read outside render. */
function readUpdatesDenial(environmentId: EnvironmentId): string | undefined {
  return managedUpdatesDenial(
    appAtomRegistry.get(environmentPresentations.serverConfigsAtom).get(environmentId)
      ?.managedPolicy,
    m,
  );
}

/** Hosts refuse a Stable/Nightly crossing outside a track switch, which checks the database first. */
function refusedCrossing(
  target: {
    readonly selfUpdate: ServerSelfUpdateCapability | null;
    readonly targetVersion: string;
    readonly channel?: DesktopUpdateChannel | undefined;
  },
  serverVersion: string | undefined,
): boolean {
  return (
    target.channel === undefined &&
    target.selfUpdate !== null &&
    serverVersion !== undefined &&
    crossesReleaseTrack(serverVersion, target.targetVersion)
  );
}

function CrossTrackNote() {
  return (
    <span className="text-muted-foreground text-xs">
      <T>Switch tracks in About → Update track</T>
    </span>
  );
}

function updateFailureMessage(error: unknown): string {
  return thrownErrorMessage(error, m) ?? m(msg("Server update failed."));
}

function serverUpdateMethodLabel(
  capability: ServerSelfUpdateCapability | null,
  resolve: MessageResolver,
): string {
  if (capability === "desktop-managed")
    return resolve(msg("desktop updater, using its own release feed"));
  if (capability === "boot-service") return resolve(msg("existing standalone installation"));
  return resolve(msg("existing server updater"));
}

export interface ServerUpdateTarget {
  readonly environmentId: EnvironmentId;
  readonly serverLabel: string;
  readonly selfUpdate: ServerSelfUpdateCapability | null;
  readonly installation?: ServerInstallation | undefined;
  readonly desktopAppUpdate?: boolean;
  readonly targetVersion: string;
  readonly currentVersion?: string;
  /** Set only by a track switch; the host's desktop app moves to this track. */
  readonly channel?: DesktopUpdateChannel;
  /** A track switch's checked release migration; the host re-checks its own database. */
  readonly targetDatabaseMigration?: number;
  /** The host already runs its track's newest build and only saves the track. */
  readonly trackOnly?: boolean;
}

type UpdateButtonProps = Pick<ComponentProps<typeof Button>, "variant" | "size" | "className"> & {
  readonly label?: string;
  readonly confirmRestart?: boolean;
  readonly appearance?: "button" | "icon";
};

export type ServerUpdateOutcome =
  | { readonly status: "updated" | "skipped" }
  | { readonly status: "failed"; readonly message: string };

/** Toasts its success or failure unless `quiet`; never rejects. */
export function useServerUpdate() {
  const updateServer = useAtomCommand(serverEnvironment.updateServer, { reportFailure: false });
  return async (
    target: ServerUpdateTarget,
    { quiet = false }: { readonly quiet?: boolean } = {},
  ): Promise<ServerUpdateOutcome> => {
    const { environmentId, serverLabel, selfUpdate, targetVersion } = target;
    const denial = readUpdatesDenial(environmentId);
    if (denial !== undefined) {
      if (!quiet) {
        toastManager.add({
          type: "error",
          title: m(msg("{serverLabel} not updated", { serverLabel })),
          description: denial,
        });
      }
      return { status: "failed", message: denial };
    }
    if (
      !canUpdateServer(appAtomRegistry.get(environmentSession.sessionStateAtom(environmentId))) ||
      pendingUpdateEnvironmentIds.has(environmentId)
    )
      return { status: "skipped" };
    pendingUpdateEnvironmentIds.add(environmentId);
    const result = await updateServer({
      environmentId,
      input: {
        targetVersion,
        ...(target.channel === undefined ? {} : { channel: target.channel }),
        ...(target.targetDatabaseMigration === undefined
          ? {}
          : { targetDatabaseMigration: target.targetDatabaseMigration }),
      },
    });
    pendingUpdateEnvironmentIds.delete(environmentId);
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return { status: "skipped" };
      const message = updateFailureMessage(squashAtomCommandFailure(result));
      if (!quiet) {
        toastManager.add({
          type: "error",
          title: m(msg("{serverLabel} update failed", { serverLabel })),
          description: message,
        });
      }
      return { status: "failed", message };
    }
    if (!quiet) {
      toastManager.add({
        type: "success",
        title: m(msg("{serverLabel} updated", { serverLabel })),
        description:
          selfUpdate === "desktop-managed"
            ? m(
                msg("Desktop app relaunched on {version}.", {
                  version: result.value.targetVersion,
                }),
              )
            : m(msg("Reconnected on t3@{version}.", { version: result.value.targetVersion })),
      });
    }
    return { status: "updated" };
  };
}

export function ServerUpdatesAction({
  targets,
  label,
  variant = "outline",
  size = "xs",
  className,
  confirmRestart = false,
}: UpdateButtonProps & {
  readonly targets: ReadonlyArray<ServerUpdateTarget>;
}) {
  const gt = useGT();
  const messages = useMessages();
  const update = useServerUpdate();
  const serverConfigs = useServerConfigs();
  const pending = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const eligible = targets.filter(
    (target) =>
      target.selfUpdate !== null &&
      (target.selfUpdate !== "desktop-managed" || target.desktopAppUpdate) &&
      managedUpdatesDenial(serverConfigs.get(target.environmentId)?.managedPolicy, messages) ===
        undefined &&
      !refusedCrossing(target, serverConfigs.get(target.environmentId)?.environment.serverVersion),
  );
  const handleUpdate = async () => {
    if (pending.current) return;
    pending.current = true;
    setIsPending(true);
    await settlePromise(async () => {
      const available = eligible.filter(
        (target) => !pendingUpdateEnvironmentIds.has(target.environmentId),
      );
      if (available.length === 0) return;
      const desktopTargets = available.filter((target) => target.selfUpdate === "desktop-managed");
      if (confirmRestart || desktopTargets.length > 0) {
        const confirmed =
          (await requestConfirmDialog(
            confirmRestart
              ? gt(
                  "Update T3 Code on these machines?\n\n{machines}\n\nOnly T3 Code is updated, not provider CLIs. These servers or desktop apps will restart, potentially interrupting active agents and terminals.",
                  {
                    machines: available
                      .map((target) =>
                        gt("{serverLabel}: {version} via {method}", {
                          serverLabel: target.serverLabel,
                          version: target.targetVersion,
                          method: serverUpdateMethodLabel(target.selfUpdate, messages),
                        }),
                      )
                      .join("\n"),
                  },
                )
              : gt(
                  "Update the T3 Code desktop apps on {servers}? They will close and relaunch on those machines.",
                  { servers: desktopTargets.map((target) => target.serverLabel).join(", ") },
                ),
            { initialFocus: "confirm" },
          )) ?? !confirmRestart;
        if (!confirmed) return;
      }
      await Promise.all(available.map((target) => update(target)));
    });
    pending.current = false;
    setIsPending(false);
  };
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={isPending || eligible.length === 0}
      onClick={() => void handleUpdate()}
    >
      {label ?? gt("Update all")}
    </Button>
  );
}

export function canUpdateServer(
  result: AsyncResult.AsyncResult<AuthSessionState, unknown>,
): boolean {
  if (result._tag !== "Success" || !result.value.authenticated) return false;
  return sessionGrantsScope(result.value, AuthEnvironmentMaintainScope);
}

export function ServerUpdateProgress({
  state,
}: {
  readonly state: Exclude<ServerUpdateState, { status: "idle" }>;
}) {
  const messages = useMessages();
  if (state.status === "failed") {
    return (
      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-destructive" role="alert">
        <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
        <SharedTooltipTrigger
          render={
            <span className="min-w-0 truncate">{serverUpdateFailureText(state, messages)}</span>
          }
          label={serverUpdateFailureText(state, messages)}
        />
      </div>
    );
  }
  return (
    <div className="mt-1 flex items-center gap-2 text-xs font-medium text-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
      <span>{serverUpdateStageLabel(state.stage, messages)}</span>
    </div>
  );
}

/** client-runtime owns self-updates so unmounting during reconnect preserves operation state. */
export function ServerUpdateAction({
  environmentId,
  serverLabel,
  selfUpdate,
  installation,
  desktopAppUpdate = false,
  targetVersion,
  currentVersion,
  channel,
  label,
  variant = "outline",
  size = "xs",
  className,
  appearance = "button",
  confirmRestart = false,
}: ServerUpdateTarget & UpdateButtonProps) {
  const gt = useGT();
  const messages = useMessages();
  const isDesktopAppUpdate = selfUpdate === "desktop-managed";
  const serverVersion = useServerConfigs().get(environmentId)?.environment.serverVersion;
  const sessionStateAtom = environmentSession.sessionStateAtom(environmentId);
  const canUpdate = useAtomValue(sessionStateAtom, canUpdateServer);
  const updatesDenial = managedUpdatesDenial(useManagedPolicy(environmentId), messages);
  const update = useServerUpdate();
  const updatesInstall =
    installation?.kind === "npm-global" || installation?.kind === "t3-launcher";
  const { copyToClipboard } = useCopyToClipboard<{ command: string }>({
    target: updatesInstall
      ? {
          target: "update command",
          unavailableMessage: msg("Clipboard API is unavailable while copying update command."),
          failureMessage: msg("Failed to copy update command to the clipboard."),
        }
      : {
          target: "relaunch command",
          unavailableMessage: msg("Clipboard API is unavailable while copying relaunch command."),
          failureMessage: msg("Failed to copy relaunch command to the clipboard."),
        },
    onCopy: ({ command }) => {
      toastManager.add({
        type: "success",
        title: updatesInstall ? gt("Update command copied") : gt("Relaunch command copied"),
        description: updatesInstall
          ? gt("Run `{command}` on {serverLabel}, then restart t3 with your usual options.", {
              command,
              serverLabel,
            })
          : gt(
              "Stop t3 on {serverLabel}, then relaunch with `{command}` using the same subcommand and options. This does not update an installed t3 command.",
              { command, serverLabel },
            ),
      });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: gt("Could not copy update command"),
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
      const confirmed =
        (await requestConfirmDialog(
          isDesktopAppUpdate
            ? gt(
                "Update T3 Code on {serverLabel} using its desktop updater? Its own release feed selects the version. The desktop app will close and relaunch on that machine. Provider CLIs are not updated.",
                { serverLabel },
              )
            : currentVersion
              ? gt(
                  "Update T3 Code on {serverLabel} from {currentVersion} to {targetVersion} using the {method}? The server will restart, briefly disconnecting clients and potentially interrupting active agents and terminals. Provider CLIs are not updated.",
                  {
                    serverLabel,
                    currentVersion,
                    targetVersion,
                    method: serverUpdateMethodLabel(selfUpdate, messages),
                  },
                )
              : gt(
                  "Update T3 Code on {serverLabel} to {targetVersion} using the {method}? The server will restart, briefly disconnecting clients and potentially interrupting active agents and terminals. Provider CLIs are not updated.",
                  {
                    serverLabel,
                    targetVersion,
                    method: serverUpdateMethodLabel(selfUpdate, messages),
                  },
                ),
          { initialFocus: "confirm" },
        )) ?? !confirmRestart;
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
      targetVersion,
    });
  };

  if (updatesDenial !== undefined) {
    return appearance === "icon" ? (
      <ManagedControl reason={updatesDenial}>
        <Button size="icon-xs" variant="ghost-muted" aria-label={updatesDenial} disabled>
          <CircleArrowUpIcon className="size-3.5" />
        </Button>
      </ManagedControl>
    ) : (
      <span className="text-muted-foreground text-xs">{updatesDenial}</span>
    );
  }

  if (selfUpdate === "desktop-managed" && !desktopAppUpdate) {
    return (
      <span className="text-muted-foreground text-xs">
        <T>Update the desktop app on that machine to update this server.</T>
      </span>
    );
  }

  if (refusedCrossing({ selfUpdate, targetVersion, channel }, serverVersion)) {
    return <CrossTrackNote />;
  }

  const manualCommand =
    selfUpdate === null ? manualServerUpdateCommand(targetVersion, installation) : null;
  const actionLabel =
    manualCommand !== null
      ? updatesInstall
        ? gt("Copy update command")
        : gt("Copy relaunch command")
      : (label ?? gt("Update", { $context: "verb, updates the server" }));
  const onClick =
    manualCommand !== null
      ? () => copyToClipboard(manualCommand, { command: manualCommand })
      : () => void handleUpdate();

  if (appearance === "icon") {
    return (
      <SharedTooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant="ghost-muted"
            className={className}
            aria-label={gt("{action} for {serverLabel}", { action: actionLabel, serverLabel })}
            disabled={manualCommand === null && !canUpdate}
            onClick={onClick}
          />
        }
        label={actionLabel}
      >
        <CircleArrowUpIcon className="size-3.5" />
      </SharedTooltipTrigger>
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

/** Read the host descriptor's version because the host never delivers server config. */
export function OutdatedServerUpdateAction({
  environmentId,
  serverLabel,
  fromVersion,
  targetVersion,
  label,
}: {
  readonly environmentId: EnvironmentId;
  readonly serverLabel: string;
  readonly fromVersion: string | undefined;
  readonly targetVersion: string;
  readonly label?: string;
}) {
  const gt = useGT();
  const update = useAtomCommand(updateOutdatedServer, { reportFailure: false });
  const handleUpdate = async () => {
    if (pendingUpdateEnvironmentIds.has(environmentId)) return;
    pendingUpdateEnvironmentIds.add(environmentId);
    const result = await update({
      environmentId,
      input: { targetVersion },
      ...(fromVersion === undefined ? {} : { fromVersion }),
    });
    pendingUpdateEnvironmentIds.delete(environmentId);
    if (result._tag === "Failure") {
      if (isAtomCommandInterrupted(result)) return;
      toastManager.add({
        type: "error",
        title: m(msg("{serverLabel} update failed", { serverLabel })),
        description: updateFailureMessage(squashAtomCommandFailure(result)),
      });
      return;
    }
    toastManager.add({
      type: "success",
      title: m(msg("{serverLabel} updated", { serverLabel })),
      description: m(msg("Reconnected on t3@{version}.", { version: result.value.targetVersion })),
    });
  };
  if (fromVersion !== undefined && crossesReleaseTrack(fromVersion, targetVersion)) {
    return <CrossTrackNote />;
  }
  return (
    <Button size="xs" variant="outline" onClick={() => void handleUpdate()}>
      {label ?? gt("Update", { $context: "verb, updates the server" })}
    </Button>
  );
}

export function ServerReleaseCheckAction({
  environmentId,
  serverLabel,
  clientTarget,
  appearance = "button",
}: {
  readonly environmentId: EnvironmentId;
  readonly serverLabel: string;
  readonly clientTarget: string | null;
  readonly appearance?: "button" | "icon";
}) {
  const gt = useGT();
  const messages = useMessages();
  const config = useServerConfigs().get(environmentId);
  const currentVersion = config?.environment.serverVersion;
  const [result, setResult] = useState<{
    currentVersion: string;
    targetVersion: string | null;
    status: "checking" | "checked" | "failed";
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- abort the external release request when the Settings control unmounts
  useEffect(() => () => request.current?.abort(), []);
  const currentResult = result?.currentVersion === currentVersion ? result : null;
  const targetVersion = environmentUpdateTarget(clientTarget, currentResult?.targetVersion ?? null);
  const denial = managedUpdatesDenial(config?.managedPolicy, messages);
  const check = async () => {
    if (!currentVersion || request.current !== null) return;
    const controller = new AbortController();
    request.current = controller;
    setResult({
      currentVersion,
      targetVersion: currentResult?.targetVersion ?? null,
      status: "checking",
    });
    try {
      const target = await findEnvironmentUpdate(currentVersion, controller.signal);
      if (!controller.signal.aborted)
        setResult({ currentVersion, targetVersion: target, status: "checked" });
    } catch (error) {
      if (!controller.signal.aborted) {
        setResult({
          currentVersion,
          targetVersion: currentResult?.targetVersion ?? null,
          status: "failed",
        });
        toastManager.add({
          type: "error",
          title: gt("Could not check for updates on {serverLabel}", { serverLabel }),
          description: thrownErrorMessage(error, messages),
        });
      }
    }
    if (request.current === controller) request.current = null;
  };
  const label =
    currentResult?.status === "checking" ? gt("Checking for updates…") : gt("Check for updates");
  const checkButton = (
    <Button
      size={appearance === "icon" ? "icon-xs" : "sm"}
      variant={appearance === "icon" ? "ghost-muted" : "outline"}
      aria-label={gt("{action} for {serverLabel}", { action: label, serverLabel })}
      disabled={!currentVersion || currentResult?.status === "checking" || denial !== undefined}
      onClick={() => void check()}
    >
      {appearance === "icon" ? <RefreshCwIcon className="size-3.5" /> : label}
    </Button>
  );
  return (
    <div className="flex items-center gap-2">
      {currentResult?.status === "checked" && targetVersion === null ? (
        <span className="text-xs text-muted-foreground">{gt("Up to date")}</span>
      ) : null}
      {appearance === "icon" ? (
        <SharedTooltipTrigger render={checkButton} label={denial ?? label} />
      ) : (
        checkButton
      )}
      {targetVersion !== null ? (
        <ServerUpdateAction
          environmentId={environmentId}
          serverLabel={serverLabel}
          selfUpdate={resolveServerSelfUpdateCapability(config)}
          installation={config?.environment.capabilities.serverInstallation}
          desktopAppUpdate={supportsDesktopAppUpdate(config)}
          targetVersion={targetVersion}
          {...(currentVersion === undefined ? {} : { currentVersion })}
          confirmRestart
          appearance={appearance}
          size="sm"
          label={gt("Update to {version}", { version: targetVersion })}
        />
      ) : null}
    </div>
  );
}
