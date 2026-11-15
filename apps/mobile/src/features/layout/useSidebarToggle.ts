import { usePaneRole } from "../../components/ui/Pane";
import { useAdaptiveWorkspaceLayout, useWorkspacePaneState } from "./adaptive-workspace-context";
import { useUiLanguage } from "../../i18n";

/** The content pane's sidebar button, or null where there's no sidebar beside it to toggle. */
export function useSidebarToggle() {
  const { t: uiT } = useUiLanguage();

  const role = usePaneRole();
  const { layout, togglePrimarySidebar } = useAdaptiveWorkspaceLayout();
  const { panes, sidebarToggleable } = useWorkspacePaneState();
  if (role !== "content" || !sidebarToggleable) return null;
  const maximizes = panes.primarySidebarVisible && layout.variant !== "medium";
  return {
    visible: panes.primarySidebarVisible,
    accessibilityLabel: panes.primarySidebarVisible
      ? maximizes
        ? uiT("Maximize content")
        : uiT("Hide sidebar")
      : uiT("Show sidebar"),
    icon: maximizes ? "arrow.up.left.and.arrow.down.right" : "sidebar.left",
    onPress: togglePrimarySidebar,
  } as const;
}
