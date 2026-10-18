import { useUiLanguage } from "../../i18n";
import { Platform } from "react-native";

import { AndroidHeaderIconButton } from "../../components/ui/AndroidScreenHeader";

import { useAdaptiveWorkspaceLayout } from "./AdaptiveWorkspaceLayout";

export function AndroidWorkspaceSidebarButton() {
  const { t: uiT } = useUiLanguage();
  const { layout, panes, togglePrimarySidebar } = useAdaptiveWorkspaceLayout();
  if (Platform.OS !== "android" || !layout.usesSplitView) return null;

  return (
    <AndroidHeaderIconButton
      accessibilityLabel={
        panes.primarySidebarVisible ? uiT("Maximize content") : uiT("Show sidebar")
      }
      icon={panes.primarySidebarVisible ? "arrow.up.left.and.arrow.down.right" : "sidebar.left"}
      onPress={togglePrimarySidebar}
    />
  );
}
