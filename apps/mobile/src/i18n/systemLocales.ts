import { I18nManager, Platform, TurboModuleRegistry, type TurboModule } from "react-native";

export function readSystemLocales(): ReadonlyArray<string> {
  try {
    const nativeLocales =
      TurboModuleRegistry.get<{ getNativeLocales(): string[] } & TurboModule>(
        "GtReactNative",
      )?.getNativeLocales() ?? [];
    // iOS puts the app bundle locale before the user's preferred languages.
    const preferred = Platform.OS === "ios" ? nativeLocales.slice(1) : nativeLocales;
    if (preferred.length > 0) return preferred;
  } catch {
    // Older native clients may not have the GT module yet.
  }
  return [
    I18nManager.getConstants().localeIdentifier ??
      new Intl.DateTimeFormat().resolvedOptions().locale,
  ];
}
