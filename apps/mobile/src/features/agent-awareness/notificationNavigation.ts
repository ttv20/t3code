import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { setAndroidThreadOnScreen } from "./androidNotifications";
import { foregroundNotificationBehavior } from "./foregroundNotificationBehavior";
import { routeAgentNotificationResponseOnce, threadDeepLinkOnScreen } from "./notificationPayload";
import {
  consumeLastAgentNotificationResponse,
  dismissLocalCompletionNotificationsOnScreen,
} from "./notificationResponseConsumer";

let deepLinkOnScreen: string | null = null;

function dismissViewedLocalCompletionNotifications(): void {
  if (Platform.OS !== "android") return;
  void dismissLocalCompletionNotificationsOnScreen({
    threadOnScreen: () => (AppState.currentState === "active" ? deepLinkOnScreen : null),
    getPresented: () => Notifications.getPresentedNotificationsAsync(),
    dismiss: (identifier) => Notifications.dismissNotificationAsync(identifier),
  }).catch((error) => console.warn("Could not dismiss viewed completion notifications.", error));
}

/** Called with the workspace pathname on every root navigation state change. */
export function setAgentNotificationPathname(pathname: string): void {
  const next = threadDeepLinkOnScreen(pathname);
  const changed = next !== deepLinkOnScreen;
  deepLinkOnScreen = next;
  setAndroidThreadOnScreen(deepLinkOnScreen);
  if (changed) dismissViewedLocalCompletionNotifications();
}

/**
 * App-lifetime notification routing: foreground presentation suppresses the
 * thread already on screen, and taps (including the cold-start tap) open the
 * notification's deep link through `navigate`.
 */
export function installAgentNotificationNavigation(navigate: (href: string) => void): () => void {
  const handledResponseIds = new Set<string>();
  Notifications.setNotificationHandler({
    handleNotification: (notification) =>
      Promise.resolve(foregroundNotificationBehavior(notification, deepLinkOnScreen)),
  });

  const handleResponse = (response: Notifications.NotificationResponse): void => {
    routeAgentNotificationResponseOnce({ handledResponseIds, response, navigate });
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
  const appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") dismissViewedLocalCompletionNotifications();
  });
  void consumeLastAgentNotificationResponse({
    getLastResponse: () => Notifications.getLastNotificationResponseAsync(),
    clearLastResponse: () => Notifications.clearLastNotificationResponseAsync(),
    handleResponse,
  });

  return () => {
    appStateSubscription.remove();
    subscription.remove();
    Notifications.setNotificationHandler(null);
  };
}
