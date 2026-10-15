import { useUiLanguage } from "../../i18n";
import { INTERFACE_DIRECTIONS } from "@t3tools/client-runtime/i18n";

import { useClientSettings, useUpdateClientSettings } from "../../hooks/useSettings";

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { InterfaceLanguageSelect } from "../InterfaceLanguageSelect";
import { SettingsRow, SettingsSection } from "./settingsLayout";

export function LanguageSettings() {
  const direction = useClientSettings((settings) => settings.interfaceDirection);
  const updateSettings = useUpdateClientSettings();
  const { t: uiT } = useUiLanguage();
  const directions = INTERFACE_DIRECTIONS.map((option) => ({
    ...option,
    label: uiT(option.label),
  }));

  return (
    <SettingsSection title={uiT("Language & direction")} id="language-direction">
      <SettingsRow
        title={uiT("Interface language")}
        description={uiT("Choose the language used for interface labels on this device.")}
        control={<InterfaceLanguageSelect />}
      />
      <SettingsRow
        title={uiT("Interface direction")}
        description={uiT(
          "Automatic follows the interface language. Code and terminals stay left to right.",
        )}
        control={
          <Select
            items={directions}
            value={direction}
            onValueChange={(value) => {
              if (value) void updateSettings({ interfaceDirection: value });
            }}
          >
            <SelectTrigger aria-label={uiT("Interface direction")}>
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              {directions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {uiT(option.label)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
    </SettingsSection>
  );
}
