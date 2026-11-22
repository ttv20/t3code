import "./intl-polyfills";
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
import {
  createContext,
  Suspense,
  use,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { resolveLocaleSelection } from "@t3tools/client-runtime/locales";
import { useLocale } from "gt-react-native";
import { readSystemLocales } from "./systemLocales";
import { setActiveLocale } from "./messages";
import { View } from "react-native";

import { mobilePreferencesAtom } from "../state/preferences";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./locales";

// Screens import GT from here so the polyfills above always load first.
export { useGT } from "gt-react-native";

// Committed catalogs, so forks and offline installs never reach GT's CDN. English is the source.
const CATALOGS: Readonly<Record<string, () => unknown>> = {
  he: () => require("./translations/he.json"),
  ar: () => require("./translations/ar.json"),
  fa: () => require("./translations/fa.json"),
  es: () => require("./translations/es.json"),
  zh: () => require("./translations/zh.json"),
  "pt-BR": () => require("./translations/pt-BR.json"),
  fr: () => require("./translations/fr.json"),
  de: () => require("./translations/de.json"),
  ja: () => require("./translations/ja.json"),
  ko: () => require("./translations/ko.json"),
  ru: () => require("./translations/ru.json"),
  sv: () => require("./translations/sv.json"),
};

const FormattingLocaleContext = createContext(DEFAULT_LOCALE);

export function useFormattingLocale(): string {
  return use(FormattingLocaleContext);
}

initializeGT({
  defaultLocale: DEFAULT_LOCALE,
  locales: [...SUPPORTED_LOCALES],
  loadTranslations: async (locale: string) => CATALOGS[locale]?.() ?? {},
  cacheExpiryTime: null,
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
  const { catalogLocale, formattingLocale } = resolveLocaleSelection(
    useLanguagePreference(),
    readSystemLocales(),
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
  );
  // Defer catalog and formatting changes together while the next catalog loads.
  const selection = useDeferredValue(
    useMemo(() => ({ catalogLocale, formattingLocale }), [catalogLocale, formattingLocale]),
  );
  return (
    <Suspense fallback={<View className="flex-1 bg-screen" />}>
      <ControlledGTProvider locale={selection.catalogLocale}>
        <ActiveLocale />
        <FormattingLocaleContext value={selection.formattingLocale}>
          {props.children}
        </FormattingLocaleContext>
      </ControlledGTProvider>
    </Suspense>
  );
}

function ActiveLocale() {
  const locale = useLocale();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- call-time messages outside React read the committed locale after its catalog loads
  useEffect(() => setActiveLocale(locale), [locale]);
  return null;
}
