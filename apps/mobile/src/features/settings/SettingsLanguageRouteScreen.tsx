import { ScreenScrollView as ScrollView } from "../../components/ui/ScreenScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGT } from "../../i18n/I18nProvider";
import { LanguageSettingsSection } from "./LanguageSettingsSection";
import { SettingsScreen } from "./components/SettingsScreen";

export function SettingsLanguageRouteScreen() {
  const gt = useGT();
  const insets = useSafeAreaInsets();
  return (
    <SettingsScreen title={gt("Language")}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 18 }}
      >
        <LanguageSettingsSection />
      </ScrollView>
    </SettingsScreen>
  );
}
