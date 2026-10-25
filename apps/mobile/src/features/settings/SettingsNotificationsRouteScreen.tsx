import { useUiLanguage } from "../../i18n";
import * as Dialog from "../../components/ui/Dialog";
import { AuthRelayWriteScope } from "@t3tools/contracts";
import { readEnvironmentScope } from "../../state/session";
import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useAuth } from "@clerk/expo";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Notifications from "expo-notifications";
import { useNavigation } from "@react-navigation/native";
import * as Effect from "effect/Effect";
import { AsyncResult } from "effect/reactivity";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/ui/AppText";
import {
  isAtomCommandInterrupted,
  reportAtomCommandResult,
  settleAsyncResult,
  settlePromise,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { supportsAgentAwarenessPush } from "../agent-awareness/capabilities";
import {
  openAndroidLiveUpdateSettings,
  supportsAndroidLiveUpdateSettings,
} from "../agent-awareness/androidNotifications";
import { setLiveActivityUpdatesEnabled } from "../agent-awareness/liveActivityPreferences";
import { requestAgentNotificationPermission } from "../agent-awareness/notificationPermissions";
import {
  getAgentAwarenessRegistrationStatus,
  refreshAgentAwarenessRegistration,
  subscribeAgentAwarenessRegistrationStatus,
} from "../agent-awareness/remoteRegistration";
import { refreshManagedRelayEnvironments } from "../cloud/managedRelayState";
import { hasCloudPublicConfig, resolveRelayClerkTokenOptions } from "../cloud/publicConfig";
import { runtime } from "../../lib/runtime";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { useSavedRemoteConnections } from "../../state/use-remote-environment-registry";
import { SettingsRow } from "./components/SettingsRow";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";
import { SettingsScreen } from "./components/SettingsScreen";
import { resolveAgentAwarenessPlatformPresentation } from "./SettingsRouteScreen.logic";

type NotificationStatus = "checking" | "enabled" | "disabled" | "unsupported";
type LiveActivityStatus = "checking" | "enabled" | "disabled" | "signed-out" | "linking";

function useDeviceRegistered(): boolean {
  const status = useSyncExternalStore(
    subscribeAgentAwarenessRegistrationStatus,
    getAgentAwarenessRegistrationStatus,
    () => "unknown" as const,
  );
  return status === "registered";
}

export function SettingsNotificationsRouteScreen() {
  const { t: uiT } = useUiLanguage();

  if (!hasCloudPublicConfig()) {
    return (
      <SettingsScreen title={uiT("Notifications")}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName="px-5 pt-4"
        >
          <Text className="text-base text-foreground-muted">
            {uiT("Notifications require T3 Connect in this app build.")}
          </Text>
        </ScrollView>
      </SettingsScreen>
    );
  }

  return <ConfiguredSettingsNotificationsRouteScreen />;
}

function ConfiguredSettingsNotificationsRouteScreen() {
  const { t: uiT } = useUiLanguage();

  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const agentAwarenessPushAvailable = supportsAgentAwarenessPush();
  const agentAwarenessPlatform = resolveAgentAwarenessPlatformPresentation(Platform.OS);
  const agentAwarenessSubtitle =
    Platform.OS === "android" && !agentAwarenessPushAvailable
      ? uiT("Install a newer app build to enable notifications")
      : agentAwarenessPlatform.subtitle;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { getToken, isLoaded, isSignedIn } = useAuth({ treatPendingAsSignedOut: false });
  const { savedConnectionsById } = useSavedRemoteConnections();
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("checking");
  const [liveActivityStatus, setLiveActivityStatus] = useState<LiveActivityStatus>("checking");
  const liveActivityWriteInFlight = useRef(false);
  const deviceRegistered = useDeviceRegistered();
  const liveActivitiesPreferenceEnabled = AsyncResult.isSuccess(preferencesResult)
    ? preferencesResult.value.liveActivitiesEnabled !== false
    : true;
  const canClearLiveActivitiesPreference =
    AsyncResult.isSuccess(preferencesResult) &&
    preferencesResult.value.liveActivitiesEnabled !== false;

  const connections = Object.values(savedConnectionsById);
  const environmentCount = connections.length;

  const refreshNotifications = async () => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      setNotificationStatus("unsupported");
      return;
    }
    const result = await settlePromise(() => Notifications.getPermissionsAsync());
    if (result._tag === "Failure") {
      reportAtomCommandResult(result, { label: uiT("notification permission refresh") });
      setNotificationStatus("disabled");
      return;
    }
    setNotificationStatus(result.value.granted ? "enabled" : "disabled");
  };

  useEffect(() => {
    void refreshNotifications();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshNotifications();
    });
    return () => subscription.remove();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!isLoaded) {
      setLiveActivityStatus("checking");
      return;
    }
    if (!isSignedIn) {
      setLiveActivityStatus("signed-out");
      return;
    }
    if (!AsyncResult.isSuccess(preferencesResult)) {
      if (AsyncResult.isFailure(preferencesResult)) {
        reportAtomCommandResult(preferencesResult, { label: uiT("live activity preference load") });
        setLiveActivityStatus("enabled");
      } else {
        setLiveActivityStatus("checking");
      }
      return;
    }
    setLiveActivityStatus(
      preferencesResult.value.liveActivitiesEnabled === false ? "disabled" : "enabled",
    );
  }, [isLoaded, isSignedIn, preferencesResult]);

  const requestNotifications = async () => {
    const result = await settleAsyncResult(() =>
      runtime.runPromiseExit(
        requestAgentNotificationPermission.pipe(
          Effect.tap((permission) =>
            permission.type === "granted" ? refreshAgentAwarenessRegistration() : Effect.void,
          ),
        ),
      ),
    );
    if (result._tag === "Failure") {
      if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        Dialog.alert(
          uiT("Notifications unavailable"),
          error instanceof Error
            ? error.message
            : uiT("Could not request notification permission."),
        );
      }
      return;
    }
    if (result.value.type === "granted") {
      setNotificationStatus("enabled");
      if (getAgentAwarenessRegistrationStatus() === "registered") {
        Dialog.alert(
          uiT("Notifications enabled"),
          uiT("Agent notifications are enabled for this device."),
        );
      } else {
        Dialog.alert(
          uiT("Couldn't finish enabling notifications"),
          uiT(
            "Notification access was granted, but this device could not be registered with T3 Connect. Notifications will start once registration succeeds.",
          ),
        );
      }
      return;
    }
    if (result.value.type === "unsupported") {
      setNotificationStatus("unsupported");
      Dialog.alert(
        uiT("Notifications unavailable"),
        uiT("Agent notifications are unavailable on this platform."),
      );
      return;
    }
    setNotificationStatus("disabled");
    if (result.value.canAskAgain) {
      Dialog.alert(uiT("Notifications disabled"), uiT("Notifications were not enabled."));
      return;
    }
    Dialog.alert(
      uiT("Notifications disabled"),
      uiT("Notifications were denied for this app. Open Settings to enable them."),
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
  };

  const promptSignIn = () => {
    Dialog.alert(
      uiT("Sign in to T3 Connect"),
      uiT("Live Activity updates require T3 Connect so relay can deliver updates to this device."),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => navigation.navigate("SettingsAuth"),
        },
      ],
    );
  };

  const linkEnvironments = async () => {
    if (!isSignedIn) {
      promptSignIn();
      return;
    }

    setLiveActivityStatus("linking");
    if (Platform.OS === "android") {
      const permission = await settleAsyncResult(() =>
        runtime.runPromiseExit(requestAgentNotificationPermission),
      );
      if (permission._tag === "Failure") {
        setLiveActivityStatus("disabled");
        const error = squashAtomCommandFailure(permission);
        Dialog.alert(
          uiT("Ongoing activity unavailable"),
          error instanceof Error ? error.message : uiT("Could not enable agent notifications."),
        );
        return;
      }
      if (permission.value.type !== "granted") {
        setLiveActivityStatus("disabled");
        Dialog.alert(
          uiT("Notification permission needed"),
          uiT("Enable notifications in system Settings to show ongoing agent activity."),
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      setNotificationStatus("enabled");
    }
    const tokenResult = await settlePromise(() => getToken(resolveRelayClerkTokenOptions()));
    if (tokenResult._tag === "Failure") {
      setLiveActivityStatus("disabled");
      const error = squashAtomCommandFailure(tokenResult);
      Dialog.alert(
        Platform.OS === "android"
          ? uiT("Ongoing activity unavailable")
          : uiT("Live Activities unavailable"),
        error instanceof Error ? error.message : uiT("Could not enable agent activity updates."),
      );
      return;
    }
    if (!tokenResult.value) {
      promptSignIn();
      setLiveActivityStatus("signed-out");
      return;
    }

    const updateResult = await settleAsyncResult(() =>
      runtime.runPromiseExit(
        setLiveActivityUpdatesEnabled({
          canConfigureEnvironment: (environmentId) =>
            readEnvironmentScope(environmentId, AuthRelayWriteScope),
          enabled: true,
          previousEnabled: liveActivitiesPreferenceEnabled,
          clerkToken: tokenResult.value,
          connections,
        }),
      ),
    );
    if (updateResult._tag === "Failure") {
      setLiveActivityStatus("disabled");
      if (!isAtomCommandInterrupted(updateResult)) {
        const error = squashAtomCommandFailure(updateResult);
        Dialog.alert(
          Platform.OS === "android"
            ? uiT("Ongoing activity unavailable")
            : uiT("Live Activities unavailable"),
          error instanceof Error ? error.message : uiT("Could not enable agent activity updates."),
        );
      }
      return;
    }

    savePreferences({ liveActivitiesEnabled: true });
    refreshManagedRelayEnvironments();
    setLiveActivityStatus("enabled");
    // Environment linking can precede device registration; only registered devices can receive Live Activities.
    if (getAgentAwarenessRegistrationStatus() === "registered") {
      Dialog.alert(
        Platform.OS === "android"
          ? uiT("Ongoing activity enabled")
          : uiT("Live Activities enabled"),
        environmentCount > 0
          ? uiT(
              "Agent activity updates are enabled for environments this connection can configure.",
            )
          : uiT(
              "Agent activity updates are enabled. Add an environment to start receiving updates.",
            ),
      );
    } else {
      Dialog.alert(
        uiT("Couldn't finish enabling activity updates"),
        uiT(
          "This device could not be registered with T3 Connect, so activity updates won't appear yet. They'll start once registration succeeds.",
        ),
      );
    }
  };

  const handleDeviceNotificationsChange = (enabled: boolean) => {
    if (enabled) {
      if (!isSignedIn) {
        promptSignIn();
        return;
      }
      void requestNotifications();
      return;
    }

    Dialog.alert(
      uiT("Disable notifications"),
      uiT("Open system Settings to disable notifications for T3 Code."),
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open Settings", onPress: () => void Linking.openSettings() },
      ],
    );
  };

  async function disableLiveActivities() {
    let token: string | null = null;
    if (isSignedIn) {
      const tokenResult = await settlePromise(() => getToken(resolveRelayClerkTokenOptions()));
      if (tokenResult._tag === "Failure") {
        setLiveActivityStatus("enabled");
        reportAtomCommandResult(tokenResult, {
          label: uiT("live activity disable token lookup"),
        });
        return;
      }
      token = tokenResult.value;
    }

    const updateResult = await settleAsyncResult(() =>
      runtime.runPromiseExit(
        setLiveActivityUpdatesEnabled({
          canConfigureEnvironment: (environmentId) =>
            readEnvironmentScope(environmentId, AuthRelayWriteScope),
          enabled: false,
          previousEnabled: liveActivitiesPreferenceEnabled,
          clerkToken: token,
          connections,
        }),
      ),
    );
    if (updateResult._tag === "Failure") {
      setLiveActivityStatus(isSignedIn ? "enabled" : "signed-out");
      reportAtomCommandResult(updateResult, {
        label: uiT("live activity disable"),
      });
      return;
    }
    savePreferences({ liveActivitiesEnabled: false });
    refreshManagedRelayEnvironments();
    setLiveActivityStatus("disabled");
  }

  // Both writers settle their own failures, so awaiting them never throws.
  const handleLiveActivitiesChange = async (enabled: boolean) => {
    if (liveActivityWriteInFlight.current) return;
    if (!enabled) {
      liveActivityWriteInFlight.current = true;
      setLiveActivityStatus("linking");
      await disableLiveActivities();
      liveActivityWriteInFlight.current = false;
      return;
    }

    if (!isSignedIn) {
      promptSignIn();
      return;
    }

    liveActivityWriteInFlight.current = true;
    await linkEnvironments();
    liveActivityWriteInFlight.current = false;
  };

  return (
    <SettingsScreen title={uiT("Notifications")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pt-4"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 18) + 18,
        }}
      >
        <SettingsSection title={uiT("Agent activity")}>
          <SettingsSwitchRow
            icon="bell.badge"
            label={uiT("Device Notifications")}
            disabled={
              !agentAwarenessPlatform.supported ||
              !agentAwarenessPushAvailable ||
              notificationStatus === "checking" ||
              notificationStatus === "unsupported"
            }
            subtitle={agentAwarenessSubtitle}
            value={
              agentAwarenessPushAvailable && notificationStatus === "enabled" && deviceRegistered
            }
            onValueChange={handleDeviceNotificationsChange}
          />
          <SettingsSwitchRow
            disabled={
              !agentAwarenessPlatform.supported ||
              !agentAwarenessPushAvailable ||
              !isLoaded ||
              liveActivityStatus === "checking" ||
              liveActivityStatus === "linking"
            }
            icon="bolt.circle"
            label={
              Platform.OS === "android"
                ? supportsAndroidLiveUpdateSettings()
                  ? uiT("Agent Live Updates")
                  : uiT("Ongoing Agent Activity")
                : uiT("Live Activity Updates")
            }
            subtitle={agentAwarenessSubtitle}
            value={
              agentAwarenessPushAvailable &&
              (liveActivityStatus === "enabled" || liveActivityStatus === "linking") &&
              deviceRegistered
            }
            onValueChange={(enabled) => void handleLiveActivitiesChange(enabled)}
          />
          {liveActivityStatus === "signed-out" && canClearLiveActivitiesPreference ? (
            <SettingsRow
              icon="bolt.circle"
              label={uiT("Turn off Live Activity preference")}
              onPress={() => void handleLiveActivitiesChange(false)}
            />
          ) : null}
          {supportsAndroidLiveUpdateSettings() ? (
            <SettingsRow
              icon="bolt.circle"
              label={uiT("Live Update Settings")}
              onPress={() => {
                void openAndroidLiveUpdateSettings().catch(() => {
                  Dialog.alert(
                    uiT("Couldn't open Settings"),
                    uiT(
                      "Open Android Settings, select T3 Code, then enable Live Updates in Notifications.",
                    ),
                  );
                });
              }}
            />
          ) : null}
        </SettingsSection>
      </ScrollView>
    </SettingsScreen>
  );
}
