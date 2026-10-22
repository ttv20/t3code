import { useUiLanguage } from "../../i18n";
import { Toolbar } from "../../components/ui/Toolbar";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useAuth, useUser } from "@clerk/expo";
import { useNavigation } from "@react-navigation/native";
import { Platform, View } from "react-native";
import { deriveProjectGroupLabel } from "@t3tools/client-runtime/state/project-grouping";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { hasCloudPublicConfig } from "../cloud/publicConfig";
import { useAdaptiveWorkspaceLayout } from "../layout/AdaptiveWorkspaceLayout";
import { NativeStackScreenOptions } from "../../native/StackHeader";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { SettingsRow } from "./components/SettingsRow";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsScreen } from "./components/SettingsScreen";
import {
  AndroidSettingsEnvironmentFilter,
  SettingsEnvironmentFilterHeader,
} from "./components/SettingsEnvironmentFilterHeader";
import { useSettingsEnvironmentFilter } from "./settings-environment-filter";

export function SettingsRouteScreen() {
  const { t: uiT } = useUiLanguage();
  const { t, direction } = useUiLanguage();
  const navigation = useNavigation();
  const { layout } = useAdaptiveWorkspaceLayout();
  const content = hasCloudPublicConfig() ? (
    <ConfiguredSettingsRouteScreen />
  ) : (
    <LocalSettingsRouteScreen />
  );

  return (
    <>
      {Platform.OS === "ios" ? (
        <NativeStackScreenOptions
          options={{ title: t("Settings"), headerBackVisible: !layout.usesSplitView }}
        />
      ) : null}
      {Platform.OS === "ios" && layout.usesSplitView ? (
        <>
          <Toolbar placement="left">
            <Toolbar.Button
              accessibilityLabel={t("Go back")}
              icon={direction === "rtl" ? "chevron.right" : "chevron.left"}
              onPress={() => navigation.goBack()}
            />
          </Toolbar>
        </>
      ) : null}
      <SettingsEnvironmentFilterHeader closeSettings />
      {Platform.OS === "android" ? (
        <SettingsScreen title={uiT("Settings")} trailing={<AndroidSettingsEnvironmentFilter />}>
          {content}
        </SettingsScreen>
      ) : (
        content
      )}
    </>
  );
}

function ConfiguredSettingsRouteScreen() {
  const { t: uiT } = useUiLanguage();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { user } = useUser();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const accountLabel = !isLoaded
    ? uiT("Checking")
    : !isSignedIn
      ? uiT("Sign in")
      : (user?.primaryEmailAddress?.emailAddress ?? uiT("Signed in"));

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <SettingsSection title={uiT("Connections")}>
          <SettingsRow
            icon="person.crop.circle"
            label={uiT("T3 Account")}
            value={accountLabel}
            disabled={!isLoaded}
            onPress={() => navigation.navigate("SettingsSheet", { screen: "SettingsAuth" })}
          />
          <SettingsRow
            icon="desktopcomputer"
            label={uiT("Environments")}
            value={`${Object.keys(savedConnectionsById).length}`}
            valuePosition="trailing"
            target="SettingsEnvironments"
          />
          <SettingsRow
            icon="bell.badge"
            label={uiT("Notifications")}
            target="SettingsNotifications"
          />
        </SettingsSection>

        <SettingsIndexSections />
      </ScrollView>
    </View>
  );
}

function LocalSettingsRouteScreen() {
  const { t: uiT } = useUiLanguage();
  const insets = useSafeAreaInsets();
  const { savedConnectionsById } = useSavedRemoteConnections();
  const environmentCount = Object.keys(savedConnectionsById).length;

  return (
    <View collapsable={false} className="flex-1 bg-sheet">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
        }}
      >
        <SettingsSection title={uiT("Connections")}>
          <SettingsRow
            icon="desktopcomputer"
            label={uiT("Environments")}
            value={`${environmentCount}`}
            valuePosition="trailing"
            target="SettingsEnvironments"
          />
        </SettingsSection>

        <SettingsIndexSections />
      </ScrollView>
    </View>
  );
}

function SettingsIndexSections() {
  const { t: uiT } = useUiLanguage();
  const { selectedTargets, projectGroups, selectedProjectKey } = useSettingsEnvironmentFilter();
  const noServerTargets = selectedTargets.length === 0;
  const selectedProject = projectGroups.find((group) => group.key === selectedProjectKey);
  const scopedProjectMembers =
    selectedProject?.members
      .map((member) => member.project)
      .filter((project) =>
        selectedTargets.some((target) => target.environmentId === project.environmentId),
      ) ?? [];
  const projectLabel =
    scopedProjectMembers.length > 0
      ? deriveProjectGroupLabel({
          representative: scopedProjectMembers[0]!,
          members: scopedProjectMembers,
        })
      : (selectedProject?.label ?? uiT("Unavailable project"));
  return (
    <>
      <SettingsSection title={uiT("Interface")}>
        <SettingsRow icon="paintbrush" label={uiT("Appearance")} target="SettingsAppearance" />
        {Platform.OS === "ios" ? (
          <>
            <SettingsRow icon="keyboard" label={uiT("Keyboard")} target="SettingsKeyboard" />
            <SettingsRow icon="mic" label={uiT("Microphone")} target="SettingsMicrophone" />
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection title={uiT("Automations")}>
        <SettingsRow icon="clock" label={uiT("Scheduled tasks")} target="SettingsScheduledTasks" />
      </SettingsSection>

      <SettingsSection title={uiT("Projects & threads")}>
        {selectedProjectKey !== null ? (
          <SettingsRow
            icon="folder"
            label={uiT("Overview")}
            value={projectLabel}
            target="SettingsProjectOverview"
          />
        ) : null}
        <SettingsRow icon="folder" label={uiT("Organization")} target="SettingsOrganization" />
        <SettingsRow icon="text.bubble" label={uiT("Thread behavior")} target="SettingsThreads" />
        <SettingsRow
          icon="arrow.turn.left.up"
          label={uiT("Follow-ups")}
          target="SettingsFollowUp"
        />
        <SettingsRow icon="archivebox" label={uiT("Archived Threads")} target="SettingsArchive" />
      </SettingsSection>

      <SettingsSection title={uiT("Server settings")}>
        <SettingsRow
          icon="person.crop.circle"
          label={uiT("Provider accounts")}
          target="SettingsProviderAccounts"
          disabled={noServerTargets}
        />
        <SettingsRow
          icon="text.bubble"
          label={uiT("New threads")}
          target="SettingsEnvironmentNewThreads"
          disabled={noServerTargets}
        />
        <SettingsRow
          icon="arrow.triangle.branch"
          label={uiT("Source control")}
          target="SettingsEnvironmentSourceControl"
          disabled={noServerTargets}
        />
        <SettingsRow
          icon="text.alignleft"
          label={uiT("Agent behavior")}
          target="SettingsEnvironmentAgentBehavior"
          disabled={noServerTargets}
        />
        <SettingsRow
          icon="arrow.clockwise"
          label={uiT("Maintenance")}
          target="SettingsEnvironmentMaintenance"
          disabled={noServerTargets}
        />
      </SettingsSection>

      <SettingsSection title={uiT("App")}>
        <SettingsRow icon="chart.bar.xaxis" label={uiT("Usage")} target="SettingsUsage" />
        <SettingsRow icon="info.circle" label={uiT("About T3 Code")} target="SettingsAbout" />
      </SettingsSection>
    </>
  );
}
