import { useUiLanguage } from "../../../i18n";
import { BranchNamingMode, type ServerSettingsPatch } from "@t3tools/contracts";
import { useRef } from "react";
import { View } from "react-native";

import { AppText as Text, AppTextInput } from "../../../components/AppText";
import { SettingsChoiceRow } from "./SettingsChoiceRow";
import { SettingsSection } from "./SettingsSection";

const MODES = {
  static: { label: "Static prefix", description: "Add your prefix to the generated branch name." },
  semantic: {
    label: "Semantic prefix",
    description: "Let the model choose feat/, fix/, refactor/, or another prefix.",
  },
  custom: {
    label: "Custom instructions",
    description: "Generate the complete name with no added prefix or suffix.",
  },
} satisfies Record<BranchNamingMode, { label: string; description: string }>;

export function BranchNamingSettings(props: {
  mode: BranchNamingMode | null;
  prefix: string | null;
  instructions: string | null;
  disabled: boolean;
  onChange: (patch: ServerSettingsPatch) => void;
}) {
  const { t: uiT } = useUiLanguage();
  const prefixEdited = useRef(false);
  const instructionsEdited = useRef(false);
  return (
    <SettingsSection
      title={uiT("Worktree branch naming")}
      trailing={
        props.mode === null ? (
          <Text className="text-xs text-foreground-muted">{uiT("Mixed")}</Text>
        ) : null
      }
    >
      {BranchNamingMode.literals.map((mode, index) => (
        <SettingsChoiceRow
          key={mode}
          label={MODES[mode].label}
          description={MODES[mode].description}
          selected={props.mode === mode}
          separated={index > 0}
          disabled={props.disabled}
          onPress={() => props.onChange({ branchNamingMode: mode })}
        />
      ))}
      {props.mode === "static" ? (
        <View className="gap-2 px-4 py-3">
          <Text className="text-sm text-foreground-muted">
            {uiT("Use t3 or t3/ for t3/add-search. Leave empty for no prefix.")}
          </Text>
          <AppTextInput
            key={props.prefix}
            accessibilityLabel={uiT("Branch prefix")}
            onChangeText={() => {
              prefixEdited.current = true;
            }}
            defaultValue={props.prefix ?? ""}
            placeholder={props.prefix === null ? uiT("Mixed") : uiT("No prefix")}
            editable={!props.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            className="min-h-10 rounded-xl px-3 py-2 text-base text-foreground"
            onEndEditing={(event) => {
              const value = event.nativeEvent.text.trim();
              if (
                !props.disabled &&
                prefixEdited.current &&
                (props.prefix === null || value !== props.prefix)
              )
                props.onChange({ branchNamePrefix: value });
              prefixEdited.current = false;
            }}
          />
        </View>
      ) : null}
      {props.mode === "custom" ? (
        <View className="gap-2 px-4 py-3">
          <Text className="text-sm text-foreground-muted">
            {uiT("Append instructions to the naming prompt.")}
          </Text>
          <AppTextInput
            key={props.instructions}
            accessibilityLabel={uiT("Branch naming instructions")}
            onChangeText={() => {
              instructionsEdited.current = true;
            }}
            defaultValue={props.instructions ?? ""}
            placeholder={
              props.instructions === null
                ? uiT("Mixed. Enter instructions for all selected targets.")
                : uiT("Use julius/ followed by the issue ID and a short description.")
            }
            editable={!props.disabled}
            multiline
            autoCapitalize="sentences"
            className="min-h-24 rounded-xl px-3 py-2 text-base text-foreground"
            onEndEditing={(event) => {
              const value = event.nativeEvent.text.trim();
              if (
                !props.disabled &&
                instructionsEdited.current &&
                (props.instructions === null || value !== props.instructions)
              )
                props.onChange({ branchNameInstructions: value });
              instructionsEdited.current = false;
            }}
          />
        </View>
      ) : null}
    </SettingsSection>
  );
}
