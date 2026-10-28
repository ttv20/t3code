import { createUiTranslator, resolveUiLocale } from "@t3tools/client-runtime/i18n";
import { getClientSettings } from "./hooks/useSettings";

export function currentUiLocale() {
  return resolveUiLocale(getClientSettings().interfaceLanguage, navigator.languages);
}

export function currentUiTranslator() {
  return createUiTranslator(currentUiLocale());
}
