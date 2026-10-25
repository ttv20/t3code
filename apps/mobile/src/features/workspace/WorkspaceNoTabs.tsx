import { useUiLanguage } from "../../i18n";
import { useNavigation } from "@react-navigation/native";
import { View } from "react-native";
import { EmptyState } from "../../components/ui/EmptyState";
import { openSettings } from "../settings/settings-navigation";

export function WorkspaceNoTabs() {
  const { t: uiT } = useUiLanguage();

  const navigation = useNavigation();
  return (
    <View className="flex-1 items-center justify-center bg-screen">
      <EmptyState
        title={uiT("All sections are hidden")}
        detail={uiT("Show a section to add it back to navigation.")}
        actionLabel="Edit navigation tabs"
        variant="plain"
        onAction={() => openSettings(navigation, "SettingsNavigation")}
      />
    </View>
  );
}
