import { Host } from "@expo/ui/jetpack-compose";
import { useMemo, type ComponentProps } from "react";
import { createNativeThemeColors } from "../../lib/nativeTheme";
import { useControlTheme } from "./useControlTheme";
import { useUiLanguage } from "../../i18n";

/** One native island, using T3's resolved colors or the user's Material You palette. */
export function NativeThemeHost(
  props: Omit<ComponentProps<typeof Host>, "colorScheme" | "seedColor" | "colorOverrides">,
) {
  const { direction } = useUiLanguage();
  const { colors, colorScheme, systemColorsActive } = useControlTheme();
  const colorOverrides = useMemo(
    () => (systemColorsActive ? undefined : createNativeThemeColors(colors)),
    [colors, systemColorsActive],
  );
  return (
    <Host
      layoutDirection={direction === "rtl" ? "rightToLeft" : "leftToRight"}
      {...props}
      colorScheme={colorScheme}
      colorOverrides={colorOverrides}
    />
  );
}
