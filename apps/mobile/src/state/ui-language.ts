import { createUiTranslator, resolveUiLocale } from "@t3tools/client-runtime/i18n";
import { AsyncResult } from "effect/reactivity";
import { I18nManager } from "react-native";
import { appAtomRegistry } from "./atom-registry";
import { mobilePreferencesAtom } from "./preferences";

export function readUiTranslator() {
  const result = appAtomRegistry.get(mobilePreferencesAtom);
  const language = AsyncResult.isSuccess(result) ? result.value.interfaceLanguage : undefined;
  const systemLocale =
    I18nManager.getConstants().localeIdentifier ??
    new Intl.DateTimeFormat().resolvedOptions().locale;
  return createUiTranslator(resolveUiLocale(language ?? "system", [systemLocale]));
}
