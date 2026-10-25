import { useUiLanguage } from "../../../../i18n";
import {
  BASE_FONT_SIZE_STEP,
  MAX_BASE_FONT_SIZE,
  MIN_BASE_FONT_SIZE,
  MIN_CHAT_LINE_HEIGHT,
  MAX_CHAT_LINE_HEIGHT,
} from "../../../../lib/appearancePreferences";
import { SettingsSection } from "../../components/SettingsSection";
import { useAppearancePreferences } from "../AppearancePreferencesProvider";
import {
  AppearancePreviewSeparator,
  TextAppearancePreview,
} from "../components/AppearancePreviews";
import { FontSizeSliderRow } from "../components/FontSizeSliderRow";
import { SettingsSwitchRow } from "../../components/SettingsSwitchRow";
import { SliderRow } from "../../../../components/ui/SliderRow";

export function TextAppearanceSection() {
  const { t: uiT } = useUiLanguage();

  const {
    isReady,
    appearance,
    setBaseFontSize,
    setChatFontSize,
    setChatLineHeight,
    mathRenderingEnabled,
    setMathRenderingEnabled,
  } = useAppearancePreferences();

  return (
    <>
      <SettingsSection title={uiT("Text")}>
        <TextAppearancePreview fontSize={appearance.baseFontSize} />
        <AppearancePreviewSeparator />
        <FontSizeSliderRow
          disabled={!isReady}
          icon="textformat.size"
          label={uiT("Text size")}
          max={MAX_BASE_FONT_SIZE}
          min={MIN_BASE_FONT_SIZE}
          onChange={setBaseFontSize}
          step={BASE_FONT_SIZE_STEP}
          value={appearance.baseFontSize}
          valueLabel={`${appearance.baseFontSize} pt`}
        />
        <SettingsSwitchRow
          disabled={!isReady}
          icon="plusminus"
          label={uiT("Render math")}
          value={mathRenderingEnabled}
          onValueChange={setMathRenderingEnabled}
        />
      </SettingsSection>
      <SettingsSection title={uiT("Chat text")}>
        <TextAppearancePreview
          fontSize={appearance.chatFontSize}
          lineHeight={appearance.chatLineHeight}
        />
        <AppearancePreviewSeparator />
        <SettingsSwitchRow
          disabled={!isReady}
          icon="textformat.size"
          label={uiT("Custom chat text size")}
          value={appearance.isChatFontSizeCustom}
          onValueChange={(enabled) => setChatFontSize(enabled ? appearance.chatFontSize : null)}
        />
        {appearance.isChatFontSizeCustom ? (
          <FontSizeSliderRow
            disabled={!isReady}
            icon="textformat.size"
            label={uiT("Chat text size")}
            max={MAX_BASE_FONT_SIZE}
            min={MIN_BASE_FONT_SIZE}
            onChange={setChatFontSize}
            step={BASE_FONT_SIZE_STEP}
            value={appearance.chatFontSize}
            valueLabel={`${appearance.chatFontSize} pt`}
          />
        ) : null}
        <SettingsSwitchRow
          disabled={!isReady}
          icon="arrow.up.and.down"
          label={uiT("Custom chat line height")}
          value={appearance.isChatLineHeightCustom}
          onValueChange={(enabled) => setChatLineHeight(enabled ? appearance.chatLineHeight : null)}
        />
        {appearance.isChatLineHeightCustom ? (
          <SliderRow
            disabled={!isReady}
            icon="arrow.up.and.down"
            label={uiT("Chat line height")}
            min={Math.max(MIN_CHAT_LINE_HEIGHT, appearance.chatFontSize + 2)}
            max={MAX_CHAT_LINE_HEIGHT}
            step={1}
            value={appearance.chatLineHeight}
            valueLabel={`${appearance.chatLineHeight} pt`}
            onChange={setChatLineHeight}
          />
        ) : null}
      </SettingsSection>
    </>
  );
}
