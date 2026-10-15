import { useUiLanguage } from "../../i18n";
import { Pressable, View } from "react-native";

import { AppText } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";

/** Opens the thread's server-hosted browser tabs. Sits beside the device preview button. */
export function BrowserPreviewButton(props: {
  readonly count: number;
  readonly onPress: () => void;
  readonly compact?: boolean;
}) {
  const { t: uiT } = useUiLanguage();
  const compact = props.compact ?? true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        props.count === 1 ? uiT("View browser") : uiT("View {0} browser tabs", { "0": props.count })
      }
      accessibilityHint={uiT("Watch and control browser tabs open in this thread")}
      onPress={props.onPress}
      className={
        compact
          ? "size-11 shrink-0 items-center justify-center rounded-full active:bg-subtle"
          : "h-11 shrink-0 flex-row items-center justify-center gap-2 rounded-full px-4 active:bg-subtle"
      }
    >
      <SymbolView name="globe" size={20} tintColorClassName="accent-icon" type="monochrome" />
      {!compact ? (
        <AppText className="font-t3-medium text-xs text-foreground">
          {props.count === 1 ? uiT("One tab open") : uiT("{0} tabs open", { "0": props.count })}
        </AppText>
      ) : props.count > 1 ? (
        <View className="absolute right-1.5 top-1.5 min-w-4 items-center rounded-full bg-primary px-1">
          <AppText className="text-2xs font-t3-bold text-primary-foreground">{props.count}</AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
