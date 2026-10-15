import {
  Button,
  Column,
  getMaterialColors,
  LinearProgressIndicator,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  paddingAll,
} from "@expo/ui/jetpack-compose/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

import type { SubscriptionUsageSnapshot as SubscriptionUsageProps } from "./subscriptionUsageSnapshot";

export function SubscriptionUsage(props: SubscriptionUsageProps, environment: WidgetEnvironment) {
  "widget";
  // Layouts run outside React and the app bundle. Receive only the needed copy.
  const uiT = (message: string, values?: Readonly<Record<string, string | number>>) =>
    (props.messages?.[message] ?? message).replace(/\{(\w+)\}/g, (token, key: string) =>
      values && Object.hasOwn(values, key) ? String(values[key]) : token,
    );
  // The widget runtime evaluates this function without the app's module scope.
  // Android has no timeline, so freshness is decided on every render; the
  // expiry alarm and each tap trigger one while the app is closed.
  const now = Date.now();
  // The 4x3 default cell fits two quotas per provider with their reset text.
  const limit = 2;
  const colors = getMaterialColors({
    scheme: environment.colorScheme === "dark" ? "dark" : "light",
  });
  const muted = colors.onSurfaceVariant;
  const providers = props.providers ?? [
    {
      name: "Codex",
      detail: uiT("Open T3 to connect"),
      windows: [],
      expiresAt: 0,
      totalWindows: 0,
    },
    {
      name: "Claude",
      detail: uiT("Open T3 to connect"),
      windows: [],
      expiresAt: 0,
      totalWindows: 0,
    },
  ];
  return (
    // The card is one Button so a tap reaches the app's interaction listener,
    // which opens props.url. expo-widgets has no Android counterpart to widgetURL.
    <Button
      colors={{ containerColor: colors.surface }}
      modifiers={[fillMaxSize()]}
      onClick={() => {}}
    >
      <Column modifiers={[fillMaxSize(), paddingAll(16)]}>
        {providers.map((provider, index) => {
          const stale =
            provider.windows.length > 0 && provider.expiresAt > 0 && now >= provider.expiresAt;
          const shown = stale ? [] : provider.windows.slice(0, limit);
          const hidden = stale ? 0 : (provider.totalWindows ?? provider.windows.length) - limit;
          return (
            <Column
              key={provider.name}
              modifiers={[fillMaxWidth(), padding(0, index === 0 ? 0 : 10, 0, 0)]}
            >
              <Text
                color={colors.onSurface}
                maxLines={1}
                style={{ fontSize: 13, fontWeight: "bold" }}
              >
                {provider.name}
              </Text>
              {shown.length === 0 ? (
                <Text color={muted} maxLines={1} style={{ fontSize: 11 }}>
                  {stale ? uiT("Open T3 to refresh") : provider.detail}
                </Text>
              ) : null}
              {shown.map((window) => {
                const low = window.remaining <= 10;
                return (
                  <Column key={window.label} modifiers={[fillMaxWidth(), padding(0, 4, 0, 0)]}>
                    <Text
                      color={low ? colors.error : colors.onSurface}
                      maxLines={1}
                      style={{ fontSize: 11 }}
                    >
                      {uiT("{0} · {1}% left", { "0": window.label, "1": window.remaining })}
                    </Text>
                    <Column modifiers={[fillMaxWidth(), padding(0, 3, 0, 3)]}>
                      <LinearProgressIndicator
                        progress={window.remaining / 100}
                        color={low ? colors.error : colors.primary}
                        trackColor={colors.surfaceVariant}
                        modifiers={[fillMaxWidth(), height(6)]}
                      />
                    </Column>
                    <Text color={muted} maxLines={1} style={{ fontSize: 10 }}>
                      {window.reset}
                    </Text>
                  </Column>
                );
              })}
              {hidden > 0 ? (
                <Text color={muted} maxLines={1} style={{ fontSize: 10 }}>
                  {uiT("{0} more in T3", { "0": hidden })}
                </Text>
              ) : null}
            </Column>
          );
        })}
        <Text
          color={muted}
          maxLines={1}
          style={{ fontSize: 10 }}
          modifiers={[padding(0, 10, 0, 0)]}
        >
          {props.checkedAt
            ? uiT("As of {0}", {
                "0": new Date(props.checkedAt).toLocaleString(props.locale, {
                  hour: "numeric",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric",
                }),
              })
            : uiT("Tap to connect in T3")}
        </Text>
      </Column>
    </Button>
  );
}

export default createWidget("SubscriptionUsage", SubscriptionUsage);
