import { createUiTranslator, type UiLocale } from "@t3tools/client-runtime/i18n";
import { isWorkspaceCatalogPending, type WorkspaceState } from "../../state/workspaceModel";

export interface HomeEmptyState {
  readonly title: string;
  readonly detail: string;
  readonly loading: boolean;
  readonly showsAddEnvironment: boolean;
}

export function deriveHomeEmptyState(
  catalogState: WorkspaceState,
  projectCount: number,
  locale: UiLocale = "en",
): HomeEmptyState {
  const emptyState = deriveEmptyState(catalogState, projectCount, locale);
  return {
    ...emptyState,
    showsAddEnvironment: !emptyState.loading && !catalogState.hasReadyEnvironment,
  };
}

function deriveEmptyState(
  catalogState: WorkspaceState,
  projectCount: number,
  locale: UiLocale,
): Omit<HomeEmptyState, "showsAddEnvironment"> {
  const uiT = createUiTranslator(locale);
  if (catalogState.isLoadingConnections) {
    return {
      title: uiT("Loading environments"),
      detail: uiT("Checking saved environments on this device."),
      loading: true,
    };
  }

  if (!catalogState.hasConnections) {
    return {
      title: uiT("No environments connected"),
      detail: uiT("Add an environment to load projects and start coding sessions."),
      loading: false,
    };
  }

  if (
    (catalogState.connectionState === "available" ||
      catalogState.connectionState === "offline" ||
      catalogState.connectionState === "error" ||
      catalogState.connectionState === "unsupported") &&
    !catalogState.hasLoadedShellSnapshot
  ) {
    return {
      title:
        catalogState.connectionState === "unsupported"
          ? uiT("Client not supported")
          : uiT("Environment unavailable"),
      detail:
        catalogState.connectionError ??
        uiT(
          "The saved environment is offline. Check the URL or start the environment, then retry.",
        ),
      loading: false,
    };
  }

  if (isWorkspaceCatalogPending(catalogState)) {
    return {
      title: catalogState.hasReadyEnvironment
        ? uiT("Loading threads")
        : uiT("Connecting to environment"),
      detail: uiT("Loading projects and threads from the saved environment."),
      loading: true,
    };
  }

  if (projectCount === 0 && catalogState.hasLoadedShellSnapshot) {
    return {
      title: uiT("No projects found"),
      detail: uiT("The connected environment did not report any projects."),
      loading: false,
    };
  }

  return {
    title: uiT("No threads yet"),
    detail: uiT("Create a task to start a new coding runtime in one of your connected projects."),
    loading: false,
  };
}
