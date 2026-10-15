import { UiLanguageContext } from "./i18n";
import { useMemo, type ReactNode } from "react";
import { I18nManager, View } from "react-native";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import {
  createUiTranslator,
  resolveUiDirection,
  resolveUiLocale,
} from "@t3tools/client-runtime/i18n";
import { mobilePreferencesAtom } from "./state/preferences";

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const preferences = useAtomValue(mobilePreferencesAtom);
  const stored = AsyncResult.isSuccess(preferences) ? preferences.value : null;
  const systemLocale =
    I18nManager.getConstants().localeIdentifier ??
    new Intl.DateTimeFormat().resolvedOptions().locale;
  const locale = resolveUiLocale(stored?.interfaceLanguage ?? "system", [systemLocale]);
  const direction = resolveUiDirection(locale, stored?.interfaceDirection ?? "auto");
  const value = useMemo(
    () => ({ locale, direction, t: createUiTranslator(locale) }),
    [locale, direction],
  );

  // Yoga inherits this direction. Avoid forceRTL, which needs a native app restart.
  return (
    <UiLanguageContext value={value}>
      <View style={{ flex: 1, direction }}>{children}</View>
    </UiLanguageContext>
  );
}
