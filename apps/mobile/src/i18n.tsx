import { createContext, useContext, Fragment, type ReactNode } from "react";
import {
  createUiTranslator,
  splitUiTextSlots,
  type UiDirection,
  type UiLocale,
} from "@t3tools/client-runtime/i18n";

export const UiLanguageContext = createContext({
  locale: "en" as UiLocale,
  direction: "ltr" as UiDirection,
  t: createUiTranslator("en"),
});

export function useUiLanguage() {
  return useContext(UiLanguageContext);
}

/** A translated sentence can reorder inline controls and emphasis without changing their content. */
export function UiText({
  message,
  values = {},
}: {
  message: string;
  values?: Readonly<Record<string, ReactNode>>;
}) {
  const { t } = useUiLanguage();
  return splitUiTextSlots(t(message)).map(({ key, text, slot }) => (
    <Fragment key={key}>
      {slot !== null && Object.hasOwn(values, slot) ? values[slot] : text}
    </Fragment>
  ));
}
