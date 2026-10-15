import { useUiLanguage } from "../i18n";
import type { ComponentProps } from "react";
import { MaterialFloatingActionButton } from "./MaterialFloatingActionButton.android";
import { MaterialScrollComposeButton } from "./MaterialScrollComposeButton.android";
import type { MaterialNewThreadButton as SharedMaterialNewThreadButton } from "./MaterialNewThreadButton.shared";

export function MaterialNewThreadButton(
  props: ComponentProps<typeof SharedMaterialNewThreadButton>,
) {
  const { t: uiT } = useUiLanguage();
  if (props.extended && props.expanded !== undefined) {
    return <MaterialScrollComposeButton {...props} expanded={props.expanded} />;
  }
  return (
    <MaterialFloatingActionButton
      {...props}
      icon="square.and.pencil"
      label={uiT("New thread")}
      tone="primary"
      variant={props.extended ? "extended" : "large"}
    />
  );
}
