import { Text } from "@expo/ui/jetpack-compose";
import { View } from "react-native";
import { IconButton } from "../../components/ui/IconButton";
import { NativeAppBar } from "../../components/ui/NativeAppBar.android";
import { useUiLanguage } from "../../i18n";

export function NativeAppBarExample() {
  const { t: uiT } = useUiLanguage();

  return (
    <NativeAppBar
      title={<Text style={{ fontSize: 21 }}>Native app bar</Text>}
      navigationIcon={
        <IconButton icon="arrow.left" accessibilityLabel={uiT("Example back")} onPress={() => {}} />
      }
      actions={
        <View className="flex-row">
          <IconButton
            icon="magnifyingglass"
            accessibilityLabel={uiT("Example search")}
            onPress={() => {}}
          />
        </View>
      }
    />
  );
}
