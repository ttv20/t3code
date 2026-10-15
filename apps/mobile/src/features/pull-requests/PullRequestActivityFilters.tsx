import { useUiLanguage } from "../../i18n";
import { Pressable, View } from "react-native";
import { AppText as Text } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { ControlPillMenu } from "../../components/ControlPillMenu";
import type { ActivityFilter } from "./pullRequestActivityFilter";

export function PullRequestActivityFilters({
  value,
  onChange,
  hiddenCount,
}: {
  readonly value: ActivityFilter;
  readonly onChange: (value: ActivityFilter) => void;
  readonly hiddenCount: number;
}) {
  const { t: uiT } = useUiLanguage();
  const kinds = [
    { id: "all", title: uiT("All activity") },
    { id: "comments", title: uiT("Comments") },
    { id: "commits", title: uiT("Commits") },
  ] as const;
  return (
    <View className="mb-4 flex-row items-center justify-between gap-3">
      <ControlPillMenu
        title={uiT("Activity")}
        actions={kinds.map((kind) => ({ ...kind, state: value.kind === kind.id ? "on" : "off" }))}
        onPressAction={({ nativeEvent }) => {
          const kind = kinds.find((item) => item.id === nativeEvent.event);
          if (kind) onChange({ ...value, kind: kind.id });
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiT("Activity type, {0}", {
            "0": kinds.find((kind) => kind.id === value.kind)?.title,
          })}
          className="min-h-11 flex-row items-center gap-2 active:opacity-60"
        >
          <Text className="text-sm font-t3-semibold">
            {kinds.find((kind) => kind.id === value.kind)?.title}
          </Text>
          <SymbolView name="chevron.down" size={11} tintColorClassName="accent-icon-muted" />
        </Pressable>
      </ControlPillMenu>
      <View className="flex-row items-center gap-3">
        <ControlPillMenu
          title={uiT("Show in activity")}
          actions={[
            { id: "bots", title: uiT("Bot comments"), state: value.bots ? "on" : "off" },
            {
              id: "resolved",
              title: uiT("Resolved or dismissed"),
              state: value.resolved ? "on" : "off",
            },
          ]}
          onPressAction={({ nativeEvent: { event } }) => {
            if (event === "bots" || event === "resolved")
              onChange({ ...value, [event]: !value[event] });
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={uiT("Filter activity, {0} hidden", { "0": hiddenCount })}
            className="min-h-11 flex-row items-center gap-1.5 active:opacity-60"
          >
            {hiddenCount > 0 ? (
              <Text className="text-xs text-foreground-muted">
                {hiddenCount} {uiT("hidden")}
              </Text>
            ) : null}
            <SymbolView
              name="line.3.horizontal.decrease"
              size={18}
              tintColorClassName="accent-icon-muted"
            />
          </Pressable>
        </ControlPillMenu>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value.newestFirst ? uiT("Newest first") : uiT("Oldest first")}
          onPress={() => onChange({ ...value, newestFirst: !value.newestFirst })}
          className="h-11 flex-row items-center gap-1 active:opacity-60"
        >
          <SymbolView
            name={value.newestFirst ? "arrow.down" : "arrow.up"}
            size={18}
            tintColorClassName="accent-icon-muted"
          />
          <Text className="text-xs text-foreground-muted">
            {value.newestFirst ? uiT("Newest") : uiT("Oldest")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
