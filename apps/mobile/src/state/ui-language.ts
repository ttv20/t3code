import { readSystemLocales } from "../i18n/systemLocales";
import { createUiTranslator, resolveUiLocale } from "@t3tools/client-runtime/i18n";
import { AsyncResult } from "effect/reactivity";

import { appAtomRegistry } from "./atom-registry";
import { mobilePreferencesAtom } from "./preferences";

export function readUiTranslator() {
  const result = appAtomRegistry.get(mobilePreferencesAtom);
  const language = AsyncResult.isSuccess(result) ? result.value.interfaceLanguage : undefined;
  return createUiTranslator(resolveUiLocale(language ?? "system", readSystemLocales()));
}
