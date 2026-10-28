import { useUiLanguage } from "../i18n";
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Platform } from "react-native";
import { useAppearancePreferences } from "../features/settings/appearance/AppearancePreferencesProvider";
import { environmentCatalog } from "../connection/catalog";
import { environmentPresentations } from "../state/presentation";
import { publishSubscriptionUsage } from "./publishSubscriptionUsage";
import { buildSubscriptionUsageSnapshot } from "./subscriptionUsageSnapshot";
import { createWidgetTheme } from "./widgetTheme";

// Isolate quota changes from the much busier thread/config presentation stream.
const snapshotAtom = Atom.make((get) =>
  buildSubscriptionUsageSnapshot(
    get(environmentPresentations.presentationsWithProvidersAtom),
    Linking.createURL("settings/usage", { queryParams: { tab: "limits" } }),
    Platform.OS === "android" ? Infinity : 6,
  ),
).pipe(Atom.withEquality((a, b) => JSON.stringify(a) === JSON.stringify(b)));

export function SubscriptionUsageCoordinator() {
  const { t, locale } = useUiLanguage();
  const {
    themeMode,
    themeAppearance,
    themeVariablesByAppearance,
    isReady: appearanceReady,
  } = useAppearancePreferences();
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const snapshot = useAtomValue(snapshotAtom);
  const androidAppearance = Platform.OS === "android" ? themeAppearance : null;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- publishes subscription usage and theme to the native home screen widget
  useEffect(() => {
    if (!catalog.isReady || !appearanceReady) return;
    void Promise.resolve()
      .then(() =>
        publishSubscriptionUsage({
          ...snapshot,
          theme: createWidgetTheme(themeMode, themeVariablesByAppearance),
          locale,
          messages: Object.fromEntries(
            [
              "Open T3 to connect",
              "Open T3 to refresh",
              "Open T3",
              "{0} · {1}% left",
              "{0}% left",
              "% left",
              "{0} more in T3",
              "more in T3",
              "No subscription limits available.",
              "As of {0}",
              "Tap to connect in T3",
            ].map((message) => [message, t(message)]),
          ),
          providers: snapshot.providers.map((provider) => ({
            ...provider,
            detail: t(provider.detail),
            windows: provider.windows.map((window) => ({ ...window, label: t(window.label) })),
          })),
        }),
      )
      .catch((error: unknown) => {
        console.warn("Could not update subscription usage widget", error);
      });
  }, [
    catalog.isReady,
    appearanceReady,
    snapshot,
    locale,
    t,
    themeMode,
    themeVariablesByAppearance,
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Android stores resolved colors; System appearance changes must republish them.
    androidAppearance,
  ]);
  return null;
}
