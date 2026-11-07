import { View } from "react-native";
import { useUiLanguage } from "../../../i18n";

import { AppText as Text } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { SettingsSection } from "./SettingsSection";

export function SettingsProjectOverridesSection(props: {
  readonly projectLabel: string;
  readonly hasOverrides: boolean;
  readonly pending: boolean;
  readonly disabled?: boolean;
  readonly onClear: () => void;
}) {
  const { t: uiT } = useUiLanguage();

  return (
    <SettingsSection title={uiT("Project")}>
      <View className="min-h-16 flex-row items-center gap-3 px-4 py-3">
        <Text className="min-w-0 flex-1 text-base text-foreground" numberOfLines={2}>
          {props.projectLabel}
        </Text>
        {!props.pending && props.hasOverrides ? (
          <Button
            label={uiT("Use defaults")}
            accessibilityHint={uiT("Use environment defaults for this project")}
            tone="text"
            disabled={props.disabled}
            onPress={props.onClear}
          />
        ) : null}
      </View>
    </SettingsSection>
  );
}
