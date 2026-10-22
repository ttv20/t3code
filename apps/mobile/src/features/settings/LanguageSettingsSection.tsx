import { useUiLanguage } from "../../i18n";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { View } from "react-native";
import { INTERFACE_DIRECTIONS, INTERFACE_LANGUAGES } from "@t3tools/client-runtime/i18n";

import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import { SettingsSection } from "./components/SettingsSection";
import { SettingsChoiceRow } from "./components/SettingsChoiceRow";

export function LanguageSettingsSection() {
  const { t: uiT } = useUiLanguage();
  const result = useAtomValue(mobilePreferencesAtom);
  const update = useAtomSet(updateMobilePreferencesAtom);
  const preferences = AsyncResult.isSuccess(result) ? result.value : null;

  return (
    <View className="gap-6">
      <SettingsSection title={uiT("Interface language")}>
        {INTERFACE_LANGUAGES.map((option, index) => (
          <SettingsChoiceRow
            key={option.value}
            label={uiT(option.label)}
            separated={index > 0}
            selected={(preferences?.interfaceLanguage ?? "system") === option.value}
            onPress={() => update({ interfaceLanguage: option.value })}
          />
        ))}
      </SettingsSection>
      <SettingsSection
        title={uiT("Interface direction")}
        footer={uiT(
          "Automatic follows the interface language. Code and terminals stay left to right.",
        )}
      >
        {INTERFACE_DIRECTIONS.map((option, index) => (
          <SettingsChoiceRow
            key={option.value}
            label={uiT(option.label)}
            separated={index > 0}
            selected={(preferences?.interfaceDirection ?? "auto") === option.value}
            onPress={() => update({ interfaceDirection: option.value })}
          />
        ))}
      </SettingsSection>
    </View>
  );
}
