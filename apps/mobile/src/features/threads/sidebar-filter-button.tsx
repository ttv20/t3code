import { useUiLanguage } from "../../i18n";
import { SymbolView } from "../../components/ui/AppSymbol";
import { Pressable } from "react-native";

export type SidebarFilterButtonIcon =
  | "line.3.horizontal.decrease.circle"
  | "line.3.horizontal.decrease.circle.fill";

export function SidebarFilterButton(props: {
  readonly accessibilityLabel: string;
  readonly icon: SidebarFilterButtonIcon;
}) {
  const { t: uiT } = useUiLanguage();

  return (
    <Pressable
      className="size-11 cursor-pointer items-center justify-center rounded-full bg-subtle active:opacity-70"
      accessibilityLabel={uiT(props.accessibilityLabel)}
      accessibilityRole="button"
      hitSlop={4}
    >
      <SymbolView
        name={props.icon}
        size={16}
        tintColorClassName="accent-foreground"
        type="monochrome"
      />
    </Pressable>
  );
}
