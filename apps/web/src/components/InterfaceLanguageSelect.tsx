import { INTERFACE_LANGUAGES } from "@t3tools/client-runtime/i18n";

import { useClientSettings, useUpdateClientSettings } from "../hooks/useSettings";
import { useUiLanguage } from "../i18n";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";

/** Device-local language choice, available before onboarding is complete. */
export function InterfaceLanguageSelect() {
  const language = useClientSettings((settings) => settings.interfaceLanguage);
  const updateSettings = useUpdateClientSettings();
  const { t, locale } = useUiLanguage();
  const languages = INTERFACE_LANGUAGES.map((option) => ({ ...option, label: t(option.label) }));

  return (
    <Select
      items={languages}
      value={language}
      onValueChange={(value) => {
        if (value) void updateSettings({ interfaceLanguage: value });
      }}
    >
      <SelectTrigger aria-label={t("Interface language")}>
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {languages.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span lang={option.value === "system" ? locale : option.value} dir="auto">
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}
