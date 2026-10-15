import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import * as Linking from "expo-linking";
import { useEffect } from "react";
import { Platform } from "react-native";
import { environmentCatalog } from "../connection/catalog";
import { environmentPresentations } from "../state/presentation";
import { publishSubscriptionUsage } from "./publishSubscriptionUsage";
import { useSubscriptionUsage } from "./useSubscriptionUsage";
import { buildSubscriptionUsageSnapshot } from "./subscriptionUsageSnapshot";
import { useUiLanguage } from "../i18n";

// Isolate quota changes from the much busier thread/config presentation stream.
const snapshotAtom = Atom.make((get) =>
  buildSubscriptionUsageSnapshot(
    get(environmentPresentations.presentationsAtom),
    Linking.createURL("settings/usage", { queryParams: { tab: "limits" } }),
    // Android scrolls the full list; iOS stores a bounded widget timeline.
    Platform.OS === "android" ? Infinity : 6,
  ),
).pipe(Atom.withEquality((a, b) => JSON.stringify(a) === JSON.stringify(b)));

export function SubscriptionUsageCoordinator() {
  const { t, locale } = useUiLanguage();
  const catalog = useAtomValue(environmentCatalog.catalogValueAtom);
  const snapshot = useAtomValue(snapshotAtom);
  useSubscriptionUsage(catalog.isReady);
  useEffect(() => {
    if (!catalog.isReady) return;
    void Promise.resolve()
      .then(() =>
        publishSubscriptionUsage({
          ...snapshot,
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
  }, [catalog.isReady, locale, snapshot, t]);
  return null;
}
