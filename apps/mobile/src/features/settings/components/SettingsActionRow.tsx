import type { ComponentProps } from "react";
import { useUiLanguage } from "../../../i18n";
import { ListActionRow } from "../../../components/ui/ListActionRow";

export function SettingsActionRow(props: ComponentProps<typeof ListActionRow>) {
  const { t } = useUiLanguage();
  return <ListActionRow {...props} label={t(props.label)} />;
}
