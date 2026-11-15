import "./intl-polyfills";
import { createGtSourceCatalog } from "@t3tools/client-runtime/i18n";
import { useUiLanguage } from "../i18n";
import en from "./translations/en.json";
import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import {
  I18nStore,
  InternalGTProvider,
  type InternalGTProviderProps,
} from "@generaltranslation/react-core/components";
import {
  getReactI18nCache,
  internalInitializeGTSRA as initializeGT,
} from "@generaltranslation/react-core/pure";
import { Suspense, use, useDeferredValue, useMemo, useState, type ReactNode } from "react";
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

const translationPromises = new Map<
  string,
  Promise<InternalGTProviderProps["translations"][string]>
>();

function loadTranslations(locale: string) {
  let promise = translationPromises.get(locale);
  if (!promise) {
    promise = getReactI18nCache().loadTranslations(locale);
    translationPromises.set(locale, promise);
  }
  return promise;
}

// Interface preferences own these conditions; GT must not persist a second locale.
const keepPreference = () => {};

function ControlledGTProvider(props: { readonly locale: string; readonly children: ReactNode }) {
  const translations = use(loadTranslations(props.locale));
  const [i18nStore] = useState(() => new I18nStore());
  const snapshot = useMemo(() => ({ [props.locale]: translations }), [props.locale, translations]);
  // Native GT writes its locale asynchronously, then immediately reads the previous native value.
  return (
    <InternalGTProvider
      locale={props.locale}
      translations={snapshot}
      region={undefined}
      enableI18n
      setLocale={keepPreference}
      setRegion={keepPreference}
      setEnableI18n={keepPreference}
      i18nStore={i18nStore}
    >
      {props.children}
    </InternalGTProvider>
  );
}

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
    <Suspense fallback={<View className="flex-1 bg-screen" />}>
      <ControlledGTProvider locale={locale}>{props.children}</ControlledGTProvider>
    </Suspense>
  );
}
