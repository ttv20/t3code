import { Host } from "@expo/ui/jetpack-compose";
import { type ComponentProps } from "react";
import { createNativeThemeColors } from "../../lib/nativeTheme";
import { useControlTheme } from "./useControlTheme";
import { useUiLanguage } from "../../i18n";

export function NativeThemeHost(
  props: Omit<ComponentProps<typeof Host>, "colorScheme" | "seedColor" | "colorOverrides">,
) {
  const { direction } = useUiLanguage();
  const { colors, colorScheme, systemColorsActive } = useControlTheme();
  const colorOverrides = systemColorsActive ? undefined : createNativeThemeColors(colors);
  return (
    <Host
      layoutDirection={direction === "rtl" ? "rightToLeft" : "leftToRight"}
      {...props}
      colorScheme={colorScheme}
      colorOverrides={colorOverrides}
    />
  );
}
