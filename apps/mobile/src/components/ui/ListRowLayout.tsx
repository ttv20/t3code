import { useUiLanguage } from "../../i18n";
import type { ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

import { cn } from "../../lib/cn";
import { AppText } from "./AppText";
import { SymbolView, type AppSymbolName } from "./AppSymbol";

export interface ListRowContentProps {
  readonly icon?: AppSymbolName;
  readonly label: string;
  readonly description?: string;
  readonly detail?: string;
  readonly disabled?: boolean;
}

export function ListRowLayout({
  icon,
  label,
  description,
  detail,
  disabled,
  accessory,
  tone = "default",
}: ListRowContentProps & { readonly accessory?: ReactNode; readonly tone?: "default" | "danger" }) {
  const { direction } = useUiLanguage();
  const labelStyle = {
    writingDirection: direction,
    textAlign: "start" as const,
    alignSelf: "stretch" as const,
  };
  const { fontScale } = useWindowDimensions();
  const stackDetail = fontScale >= 1.5;
  return (
    <View
      style={{ direction }}
      className={cn(
        "min-h-14 flex-row items-center gap-3 px-4 py-3",
        description && "min-h-18",
        disabled && "opacity-45",
      )}
    >
      {icon ? (
        <View className="size-6 items-center justify-center">
          <SymbolView
            name={icon}
            size={Platform.OS === "android" ? 24 : 22}
            tintColorClassName={tone === "danger" ? "accent-danger-foreground" : "accent-icon"}
            type="monochrome"
            weight="regular"
          />
        </View>
      ) : null}
      <View className="min-w-0 flex-1 gap-1">
        <AppText
          style={labelStyle}

          textRole="body"

          className={tone === "danger" ? "text-danger-foreground" : "text-foreground"}
        >
          {label}
        </AppText>
        {description ? (
          <AppText style={labelStyle} textRole="footnote" className="text-foreground-muted">
            {description}
          </AppText>
        ) : null}
        {detail && stackDetail ? (
          <AppText style={labelStyle} textRole="footnote" className="text-foreground-muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {detail && !stackDetail ? (
        <AppText
          style={{ textAlign: "end" }}
          className="max-w-[40%] shrink text-sm text-foreground-muted"

          textRole="footnote"

          numberOfLines={1}
          ellipsizeMode="middle"
        >
          {detail}
        </AppText>
      ) : null}
      {accessory}
    </View>
  );
}
