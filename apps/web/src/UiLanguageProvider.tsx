import { UiLanguageContext } from "./i18n";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useLayoutEffect, type ReactNode } from "react";
import {
  createUiTranslator,
  resolveUiDirection,
  resolveUiLocale,
} from "@t3tools/client-runtime/i18n";
import { useClientSettings } from "./hooks/useSettings";

/** Sets document direction too, so portals inherit the selected language and layout. */
export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const language = useClientSettings((settings) => settings.interfaceLanguage);
  const directionPreference = useClientSettings((settings) => settings.interfaceDirection);
  const locale = resolveUiLocale(language, navigator.languages);
  const direction = resolveUiDirection(locale, directionPreference);
  const value = { locale, direction, t: createUiTranslator(locale) };

  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return (
    <UiLanguageContext value={value}>
      <DirectionProvider direction={direction}>{children}</DirectionProvider>
    </UiLanguageContext>
  );
}
