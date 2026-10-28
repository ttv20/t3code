import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { reportAtomCommandResult, settlePromise } from "@t3tools/client-runtime/state/runtime";
import { makePermissionStatusAtom } from "../../lib/permissionStatusAtom";

export type NotificationStatus = "checking" | "enabled" | "disabled" | "unsupported";
export const notificationStatusAtom = makePermissionStatusAtom<NotificationStatus>({
  label: "mobile:notification-permission",
  initial: "checking",
  read: async () => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return "unsupported";
    const result = await settlePromise(() => Notifications.getPermissionsAsync());
    if (result._tag === "Failure") {
      reportAtomCommandResult(result, { label: "notification permission refresh" });
      return "disabled";
    }
    return result.value.granted ? "enabled" : "disabled";
  },
});
