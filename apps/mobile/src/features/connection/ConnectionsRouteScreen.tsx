import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useUiLanguage } from "../../i18n";

import { useNavigation } from "@react-navigation/native";
import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppBar } from "../../components/ui/AppBar";
import { useRemoteConnections } from "../../state/use-remote-environment-registry";
import { LinkedEnvironmentsSection } from "./LinkedEnvironmentsSection";
import { LocalEnvironmentList } from "./LocalEnvironmentList";
import { PullRequestRoutingSettings } from "./PullRequestRoutingSettings";

export function ConnectionsRouteScreen() {
  const { t: uiT } = useUiLanguage();

  const {
    connectedEnvironments,
    onReconnectEnvironment,
    onRemoveEnvironmentPress,
    onSetEnvironmentEnabled,
    onUpdateEnvironment,
  } = useRemoteConnections();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [expandedId, setExpandedId] = useState<EnvironmentId | null>(null);
  const handleToggle = (environmentId: EnvironmentId) => {
    setExpandedId((prev) => (prev === environmentId ? null : environmentId));
  };

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <AppBar
        title={uiT("Environments")}
        onClose={() => navigation.goBack()}
        closeAccessibilityLabel={uiT("Close environments")}
        actions={[
          {
            accessibilityLabel: uiT("Add environment"),
            icon: "plus",
            onPress: () => navigation.navigate("ConnectionsNew"),
          },
        ]}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
      >
        <LocalEnvironmentList
          environments={connectedEnvironments}
          expandedId={expandedId}
          onToggle={handleToggle}
          onReconnect={onReconnectEnvironment}
          onRemove={onRemoveEnvironmentPress}
          onSetEnabled={onSetEnvironmentEnabled}
          onUpdate={onUpdateEnvironment}
        />
        {connectedEnvironments
          .filter((environment) => environment.connectionState === "connected")
          .map((environment) => (
            <LinkedEnvironmentsSection
              key={environment.environmentId}
              environmentId={environment.environmentId}
              environmentLabel={environment.environmentLabel}
            />
          ))}
        <PullRequestRoutingSettings />
      </ScrollView>
    </View>
  );
}
