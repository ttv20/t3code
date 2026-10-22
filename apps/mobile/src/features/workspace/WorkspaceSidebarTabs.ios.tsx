import { useUiLanguage } from "../../i18n";
import { View } from "react-native";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useWorkspaceTabs } from "./WorkspaceTabsContext";
import type { WorkspaceTab } from "./workspace-tabs-state";
import { useSelectWorkspaceTab } from "./useSelectWorkspaceTab";

export function WorkspaceSidebarTabs() {
  const { t: uiT } = useUiLanguage();

  const workspace = useWorkspaceTabs()!;
  const selectTab = useSelectWorkspaceTab();
  return (
    <View className="px-4 pb-3 pt-2">
      <SegmentedControl
        role="tab"
        options={[
          { value: "threads", label: uiT("Threads") },
          { value: "pullRequests", label: uiT("Pull requests") },
        ]}
        selected={workspace.state.selectedTab}
        onSelect={(tab: WorkspaceTab) => selectTab(tab)}
      />
    </View>
  );
}
