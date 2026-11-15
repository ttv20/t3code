import "./intl-polyfills";
import { createGtSourceCatalog } from "@t3tools/client-runtime/i18n";
import { useUiLanguage } from "../i18n";
import en from "./translations/en.json";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { GTProvider, initializeGT } from "gt-react-native";
import { useDeferredValue, type ReactNode } from "react";
import { View } from "react-native";

import { mobilePreferencesAtom } from "../state/preferences";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales";
import de from "./translations/de.json";
import es from "./translations/es.json";
import fr from "./translations/fr.json";
import ja from "./translations/ja.json";
import ko from "./translations/ko.json";
import ptBR from "./translations/pt-BR.json";
import ru from "./translations/ru.json";
import zh from "./translations/zh.json";

// Screens import GT from here so the polyfills above always load first.
export { useGT } from "gt-react-native";

// Committed catalogs, so forks and offline installs never reach GT's CDN. English is the source.
const TRANSLATIONS: Readonly<Record<string, Record<string, string>>> = {
  he: createGtSourceCatalog(en, "he"),
  ar: createGtSourceCatalog(en, "ar"),
  fa: createGtSourceCatalog(en, "fa"),
  es,
  zh,
  "pt-BR": ptBR,
  fr,
  de,
  ja,
  ko,
  ru,
};

initializeGT({
  defaultLocale: DEFAULT_LOCALE,
  locales: [...SUPPORTED_LOCALES],
  loadTranslations: async (locale: string) => TRANSLATIONS[locale] ?? {},
});

export function useLanguagePreference(): string {
  const preferences = useAtomValue(mobilePreferencesAtom);
  return AsyncResult.isSuccess(preferences)
    ? (preferences.value.interfaceLanguage ?? "system")
    : "system";
}

/** Translates the screens inside it into the saved language; "system" follows the device. */
export function I18nProvider(props: { readonly children: ReactNode }) {
  // GT suspends while a locale's catalog loads. Deferring the switch keeps the current language
  // on screen until then, instead of GT's full-screen spinner.
  const locale = useDeferredValue(useUiLanguage().locale);
  return (
    <GTProvider locale={locale} fallback={<View className="flex-1 bg-screen" />}>
      {props.children}
    </GTProvider>
  );
}
