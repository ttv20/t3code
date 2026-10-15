import { useUiLanguage } from "../../../i18n";
import type { ComponentProps } from "react";

import { ListToggleRow } from "../../../components/ListToggleRow";

export function SettingsSwitchRow({
  subtitle,
  ...props
}: Omit<ComponentProps<typeof ListToggleRow>, "description"> & {
  readonly subtitle?: string;
}) {
  const { t } = useUiLanguage();
  return (
    <ListToggleRow
      {...props}
      label={t(props.label)}
      description={subtitle ? t(subtitle) : undefined}
    />
  );
}
