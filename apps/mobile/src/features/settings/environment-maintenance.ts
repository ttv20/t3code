import {
  AuthOrchestrationOperateScope,
  type AuthSessionState,
  type ExecutionEnvironmentCapabilities,
  type ServerProvider,
} from "@t3tools/contracts";
export { findEnvironmentUpdate } from "@t3tools/client-runtime/environment-updates";

export function canMaintainEnvironment(session: AuthSessionState | null, connected: boolean) {
  return (
    connected &&
    session?.authenticated === true &&
    session.scopes?.includes(AuthOrchestrationOperateScope) === true
  );
}

export function supportsEnvironmentUpdate(
  capabilities: Pick<ExecutionEnvironmentCapabilities, "serverSelfUpdate" | "desktopAppUpdate">,
) {
  return (
    capabilities.serverSelfUpdate !== undefined &&
    (capabilities.serverSelfUpdate !== "desktop-managed" || capabilities.desktopAppUpdate === true)
  );
}

export function canUpdateEnvironmentProvider(provider: ServerProvider) {
  const compatibility = provider.compatibilityAdvisory?.latestVersionStatus;
  return (
    provider.installed &&
    provider.availability !== "unavailable" &&
    provider.versionAdvisory?.status === "behind_latest" &&
    provider.versionAdvisory.canUpdate &&
    provider.versionAdvisory.latestVersion !== null &&
    compatibility !== "broken" &&
    compatibility !== "unsupported" &&
    provider.updateState?.status !== "running" &&
    provider.updateState?.status !== "queued"
  );
}
