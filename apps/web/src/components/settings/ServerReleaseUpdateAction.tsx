import { useAtomValue } from "@effect/atom-react";
import {
  environmentUpdateTarget,
  findEnvironmentUpdate,
} from "@t3tools/client-runtime/environment-updates";
import {
  AuthEnvironmentMaintainScope,
  type EnvironmentId,
  type ServerConfig,
} from "@t3tools/contracts";
import { RefreshCwIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { serverEnvironment } from "~/state/server";
import { useEnvironmentScope } from "~/state/session";
import {
  resolveServerConfigVersionMismatch,
  resolveServerSelfUpdateCapability,
  supportsDesktopAppUpdate,
  supportsServerUpdateThreadContinuation,
} from "~/versionSkew";
import { ServerUpdateAction } from "../ServerUpdateAction";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

type ReleaseCheck =
  | { status: "checking" }
  | { status: "checked"; targetVersion: string | null }
  | { status: "failed"; message: string };

/** Check releases even when this client was bundled with the server it is updating. */
export function ServerReleaseUpdateAction({
  environmentId,
  serverLabel,
  serverConfig,
  appearance = "button",
}: {
  environmentId: EnvironmentId;
  serverLabel: string;
  serverConfig: ServerConfig;
  appearance?: "button" | "icon";
}) {
  const currentVersion = serverConfig.environment.serverVersion;
  const [check, setCheck] = useState<{
    environmentId: EnvironmentId;
    version: string;
    result: ReleaseCheck;
  } | null>(null);
  const request = useRef<{
    environmentId: EnvironmentId;
    version: string;
    controller: AbortController;
  } | null>(null);
  const canUpdate = useEnvironmentScope(environmentId, AuthEnvironmentMaintainScope);
  const updateState = useAtomValue(serverEnvironment.updateStateAtom(environmentId));
  useEffect(
    () => () => {
      if (
        request.current?.environmentId === environmentId &&
        request.current.version === currentVersion
      ) {
        request.current.controller.abort();
        request.current = null;
      }
    },
    [environmentId, currentVersion],
  );

  const result =
    check?.version === currentVersion && check.environmentId === environmentId
      ? check.result
      : null;
  const targetVersion = environmentUpdateTarget(
    resolveServerConfigVersionMismatch(serverConfig)?.clientVersion ?? null,
    result?.status === "checked" ? result.targetVersion : null,
  );
  const checkReleases = async () => {
    if (request.current !== null) return;
    const controller = new AbortController();
    request.current = { environmentId, version: currentVersion, controller };
    setCheck({ environmentId, version: currentVersion, result: { status: "checking" } });
    try {
      const targetVersion = await findEnvironmentUpdate(
        currentVersion,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      );
      if (!controller.signal.aborted) {
        setCheck({
          environmentId,
          version: currentVersion,
          result: { status: "checked", targetVersion },
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setCheck({
          environmentId,
          version: currentVersion,
          result: {
            status: "failed",
            message:
              error instanceof Error ? error.message : "Could not check releases. Try again.",
          },
        });
      }
    } finally {
      if (request.current?.controller === controller) request.current = null;
    }
  };

  if (updateState.status === "running") return null;
  const checkLabel = result?.status === "checking" ? "Checking…" : "Check for updates";
  const detail =
    result?.status === "failed"
      ? result.message
      : result?.status === "checked" && targetVersion === null
        ? "Up to date"
        : `Current version: ${currentVersion}`;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {appearance === "button" && result?.status === "checked" && targetVersion === null ? (
        <span className="text-xs text-muted-foreground">Up to date</span>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost-muted"
              size={appearance === "icon" ? "icon-xs" : "sm"}
              aria-label={`${checkLabel} for ${serverLabel}`}
              disabled={result?.status === "checking"}
              onClick={() => void checkReleases()}
            />
          }
        >
          {appearance === "icon" ? <RefreshCwIcon className="size-3.5" /> : checkLabel}
        </TooltipTrigger>
        <TooltipPopup side="top">
          {checkLabel}. {detail}
        </TooltipPopup>
      </Tooltip>
      {result?.status === "failed" && appearance === "button" ? (
        <span className="text-xs text-destructive" role="alert">
          {result.message}
        </span>
      ) : null}
      {targetVersion !== null && canUpdate ? (
        <ServerUpdateAction
          environmentId={environmentId}
          serverLabel={serverLabel}
          selfUpdate={resolveServerSelfUpdateCapability(serverConfig)}
          installation={serverConfig.environment.capabilities.serverInstallation}
          desktopAppUpdate={supportsDesktopAppUpdate(serverConfig)}
          threadContinuation={supportsServerUpdateThreadContinuation(serverConfig)}
          targetVersion={targetVersion}
          currentVersion={currentVersion}
          label={`Update to ${targetVersion}`}
          appearance={appearance}
          size="sm"
          confirmRestart
        />
      ) : null}
    </div>
  );
}
