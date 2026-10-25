import { UiLanguageContext } from "./i18n";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { ReactNode } from "react";
import {
  createUiTranslator,
  resolveUiDirection,
  resolveUiLocale,
} from "@t3tools/client-runtime/i18n";
import { useClientSettings } from "./hooks/useSettings";

export function UiLanguageProvider({ children }: { children: ReactNode }) {
  const language = useClientSettings((settings) => settings.interfaceLanguage);
  const directionPreference = useClientSettings((settings) => settings.interfaceDirection);
  const locale = resolveUiLocale(language, navigator.languages);
  const direction = resolveUiDirection(locale, directionPreference);
  const value = { locale, direction, t: createUiTranslator(locale) };

  return (
    <UiLanguageContext value={value}>
      <DirectionProvider direction={direction}>{children}</DirectionProvider>
    </UiLanguageContext>
  );
}
