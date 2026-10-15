import { useUiLanguage } from "../i18n";
import { Pressable } from "react-native";

import { AppText } from "./AppText";
import { ListRowLayout, type ListRowContentProps } from "./ListRowLayout";
import { ThemedSwitch } from "./ThemedSwitch";

/** A null value means the selected environments disagree; activation sets them all on. */
export function ListToggleRow(
  props: Omit<ListRowContentProps, "detail"> & {
    readonly value: boolean | null;
    readonly onValueChange: (value: boolean) => void;
  },
) {
  const { t: uiT } = useUiLanguage();
  return (
    <ListRowLayout
      icon={props.icon}
      label={uiT(props.label)}
      description={uiT(props.description)}
      disabled={props.disabled}
      accessory={
        props.value === null ? (
          <Pressable
            accessibilityLabel={uiT("Set {0} on for selected environments", { "0": props.label })}
            accessibilityRole="button"
            accessibilityHint={props.description}
            accessibilityState={{ disabled: Boolean(props.disabled) }}
            disabled={props.disabled}
            className="rounded-full bg-subtle px-3 py-2 active:opacity-70"
            onPress={() => props.onValueChange(true)}
          >
            <AppText className="text-sm font-t3-medium text-foreground">
              {uiT("Mixed · Set on")}
            </AppText>
          </Pressable>
        ) : (
          <ThemedSwitch
            accessibilityLabel={props.label}
            accessibilityHint={props.description}
            disabled={props.disabled}
            onValueChange={props.onValueChange}
            value={props.value}
          />
        )
      }
    />
  );
}
