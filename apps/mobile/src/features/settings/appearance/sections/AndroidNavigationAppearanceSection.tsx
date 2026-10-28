import { useUiLanguage } from "../../../../i18n";
import { View } from "react-native";

import { ListChoiceRow as SettingsChoiceRow } from "../../../../components/ui/ListChoiceRow";
import { SettingsSection } from "../../components/SettingsSection";
import { useAppearancePreferences } from "../AppearancePreferencesProvider";

export function AndroidNavigationAppearanceSection() {
  const { t: uiT } = useUiLanguage();

  const { isReady, androidNavigationStyle, setAndroidNavigationStyle } = useAppearancePreferences();
  return (
    <SettingsSection title={uiT("Navigation")}>
      <View accessibilityRole="radiogroup">
        <SettingsChoiceRow
          label={uiT("One UI")}
          description={uiT("Floating navigation with a separate compose button.")}
          disabled={!isReady}
          selected={androidNavigationStyle === "one-ui"}
          onPress={() => setAndroidNavigationStyle("one-ui")}
        />
        <SettingsChoiceRow
          label={uiT("Material")}
          description={uiT("Standard Android navigation bar and side rail.")}
          disabled={!isReady}
          selected={androidNavigationStyle === "material"}
          onPress={() => setAndroidNavigationStyle("material")}
          separated
        />
      </View>
    </SettingsSection>
  );
}
