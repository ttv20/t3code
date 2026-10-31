import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { Linking, Platform } from "react-native";
import { useState } from "react";
import * as Dialog from "../../components/ui/Dialog";
import { useUiLanguage } from "../../i18n";
import { runtime } from "../../lib/runtime";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { requestAgentNotificationPermission } from "../agent-awareness/notificationPermissions";
import { notificationStatusAtom } from "../agent-awareness/notificationStatus";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsSwitchRow } from "./components/SettingsSwitchRow";

export function LocalCompletionNotificationSettings() {
  const { t: uiT } = useUiLanguage();
  const preferences = useAtomValue(mobilePreferencesAtom);
  const save = useAtomSet(updateMobilePreferencesAtom);
  const status = useAtomValue(notificationStatusAtom);
  const setStatus = useAtomSet(notificationStatusAtom);
  const [requesting, setRequesting] = useState(false);
  if (Platform.OS !== "android") return null;
  const change = async (enabled: boolean) => {
    if (!enabled) {
      save({ localCompletionNotificationsEnabled: false });
      return;
    }
    setRequesting(true);
    await runtime
      .runPromise(requestAgentNotificationPermission)
      .then((permission) => {
        setStatus(permission.type === "granted" ? "enabled" : "disabled");
        if (permission.type === "granted") save({ localCompletionNotificationsEnabled: true });
        else if (permission.type === "denied" && !permission.canAskAgain) {
          Dialog.alert(
            uiT("Notifications disabled"),
            uiT("Notifications were denied for this app. Open Settings to enable them."),
            [
              { text: uiT("Cancel"), style: "cancel" },
              { text: uiT("Open Settings"), onPress: () => void Linking.openSettings() },
            ],
          );
        }
      })
      .catch(() => {
        Dialog.alert(
          uiT("Notifications unavailable"),
          uiT("Could not request notification permission."),
        );
      })
      .finally(() => setRequesting(false));
  };
  return (
    <SettingsSection title={uiT("Local notifications")}>
      <SettingsSwitchRow
        icon="bell.badge"
        label={uiT("Local completion notifications")}
        subtitle={uiT(
          "Notify when a thread finishes in the background while connected. Works without T3 Connect; Android may pause background connections.",
        )}
        disabled={requesting || status === "checking" || !AsyncResult.isSuccess(preferences)}
        value={
          status === "enabled" &&
          AsyncResult.isSuccess(preferences) &&
          preferences.value.localCompletionNotificationsEnabled !== false
        }
        onValueChange={(enabled) => void change(enabled)}
      />
    </SettingsSection>
  );
}
