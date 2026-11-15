import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import {
  type EnvironmentId,
  type ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { memo, useRef, useState, useSyncExternalStore } from "react";
import { InfoIcon, XIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button, InlineButton } from "../ui/button";
import { formatProviderDriverKindLabel } from "../../providerModels";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { RefreshIcon } from "../ui/refresh-icon";

import { useUiLanguage } from "../../i18n";

function getIncompatibleVersion(status: ServerProvider) {
  const compatibility = status.compatibilityAdvisory;
  if (status.status === "error" && status.auth.status === "unauthenticated") return null;
  return compatibility?.status === "broken" ||
    (status.status === "ready" && compatibility?.status === "unsupported")
    ? compatibility
    : null;
}

export function getProviderStatusBannerKey(status: ServerProvider | null): string | null {
  if (!status || status.status === "disabled") return null;
  const incompatible = getIncompatibleVersion(status);
  if (incompatible) {
    return [
      status.instanceId,
      incompatible.status,
      status.version ?? "",
      incompatible.message ?? "",
    ].join("\u0000");
  }
  if (status.status === "ready") return null;
  // Antigravity validates credentials at session start; unknown restart auth is not failure.
  if (
    status.driver === "antigravity" &&
    status.installed &&
    status.status === "warning" &&
    status.auth.status === "unknown"
  ) {
    return null;
  }
  return [status.instanceId, status.status, status.auth.status, status.message ?? ""].join(
    "\u0000",
  );
}

export function shouldShowProviderStatusBanner(
  status: ServerProvider | null,
  isDismissed: boolean,
): boolean {
  return getProviderStatusBannerKey(status) !== null && !isDismissed;
}

// Built-in instance ids such as `codex` repeat across environments.
export function getProviderStatusDismissalKey(
  environmentId: string | undefined,
  status: ServerProvider | null,
): string | null {
  const bannerKey = getProviderStatusBannerKey(status);
  return bannerKey === null ? null : `${environmentId ?? ""}\u0000${bannerKey}`;
}

// A dismissal lasts the session, not one view, so opening another thread cannot bring it back.
const sessionDismissedProviderStatusBannerKeys = new Set<string>();
const dismissalListeners = new Set<() => void>();

export function dismissProviderStatusBannerForSession(bannerKey: string | null): void {
  if (bannerKey === null || sessionDismissedProviderStatusBannerKeys.has(bannerKey)) return;
  sessionDismissedProviderStatusBannerKeys.add(bannerKey);
  for (const listener of dismissalListeners) listener();
}

export function isProviderStatusBannerDismissedForSession(bannerKey: string | null): boolean {
  return bannerKey !== null && sessionDismissedProviderStatusBannerKeys.has(bannerKey);
}

function subscribeToDismissals(listener: () => void) {
  dismissalListeners.add(listener);
  return () => dismissalListeners.delete(listener);
}

export function useProviderStatusBannerDismissed(bannerKey: string | null): boolean {
  return useSyncExternalStore(subscribeToDismissals, () =>
    isProviderStatusBannerDismissedForSession(bannerKey),
  );
}

export function hasProviderSetup(status: ServerProvider): boolean {
  return (
    status.driver === "antigravity" ||
    status.setup?.canAuthenticate === true ||
    status.setup?.canInstall === true
  );
}

export function getProviderStatusMessage(
  status: ServerProvider,
  translate = createUiTranslator("en"),
): string {
  if (
    status.auth.status !== "unauthenticated" &&
    status.compatibilityAdvisory?.status === "broken" &&
    status.compatibilityAdvisory.message
  ) {
    return status.compatibilityAdvisory.message;
  }
  if (status.message) return status.message;
  const providerName = status.displayName?.trim() || formatProviderDriverKindLabel(status.driver);
  if (!status.installed && hasProviderSetup(status)) {
    return translate("Open provider setup to install {0} on this environment.", {
      "0": formatProviderDriverKindLabel(status.driver),
    });
  }
  if (status.auth.status === "unauthenticated") {
    if (hasProviderSetup(status)) {
      return status.driver === "antigravity"
        ? translate("Open provider setup to sign in with Google.")
        : translate("Open provider setup to sign in.");
    }
    return translate("Sign in via the CLI to authenticate again.");
  }
  return status.status === "ready"
    ? translate("No models are available for this provider.")
    : status.status === "error"
      ? translate("{0} provider is unavailable.", { "0": providerName })
      : translate("{0} provider has limited availability.", { "0": providerName });
}

export const ProviderStatusBanner = memo(function ProviderStatusBanner({
  environmentId,
  onDismiss,
  onOpenProviderSetup,
  status,
}: {
  environmentId: EnvironmentId;
  onDismiss: () => void;
  onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  status: ServerProvider | null;
}) {
  const { t: uiT } = useUiLanguage();
  const canRefresh = useAtomValue(serverEnvironment.refreshProviders.permissionAtom(environmentId));
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    label: uiT("Refresh provider status"),
  });
  const refreshingRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = async () => {
    if (!status || !canRefresh || refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    await refreshProviders({
      environmentId,
      input: { instanceId: status.instanceId, refreshModels: true },
    });
    refreshingRef.current = false;
    setIsRefreshing(false);
  };

  if (!status || getProviderStatusBannerKey(status) === null) {
    return null;
  }

  const providerName = status.displayName?.trim() || formatProviderDriverKindLabel(status.driver);
  const isUnauthenticated = status.status === "error" && status.auth.status === "unauthenticated";
  const incompatible = getIncompatibleVersion(status);
  const title = isUnauthenticated
    ? uiT("{0} is unauthenticated", { "0": providerName })
    : incompatible
      ? uiT(
          incompatible.status === "broken"
            ? "{0} {1} is known to be broken"
            : "{0} {1} is unsupported",
          {
            "0": providerName,
            "1": status.version ?? "",
          },
        )
      : uiT("{0} provider status", { "0": providerName });
  const message = incompatible?.message ?? getProviderStatusMessage(status, uiT);
  const isWarning =
    incompatible?.status !== "broken" && (status.status === "warning" || incompatible !== null);

  return (
    <div className="pointer-events-auto mx-auto w-fit max-w-[calc(100%-2rem)] pt-3">
      <Alert
        variant={isWarning ? "warning" : "error"}
        role={incompatible && incompatible.status !== "broken" ? "status" : "alert"}
        surface="glass"
        controlAlignment="first-line"
      >
        <InfoIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-2">
            <Tooltip>
              <TooltipTrigger render={<div className="line-clamp-3" />}>{message}</TooltipTrigger>
              <TooltipPopup side="top" className="whitespace-pre-wrap">
                {message}
              </TooltipPopup>
            </Tooltip>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {onOpenProviderSetup && hasProviderSetup(status) ? (
                <InlineButton onClick={() => onOpenProviderSetup(status.instanceId)}>
                  {uiT("Open provider setup")}
                </InlineButton>
              ) : null}
              <Button
                aria-label={uiT("Refresh {0} provider status", { "0": providerName })}
                disabled={!canRefresh || isRefreshing}
                onClick={() => void refresh()}
                size="xs"
                variant="outline"
              >
                <RefreshIcon />
                {isRefreshing ? uiT("Refreshing...") : uiT("Refresh")}
              </Button>
            </div>
          </div>
        </AlertDescription>
        <AlertAction>
          <Button
            aria-label={uiT("Dismiss {0} provider {1}", { "0": providerName, "1": status.status })}
            onClick={onDismiss}
            size="icon-xs"
            variant="ghost-muted"
          >
            <XIcon />
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
});
