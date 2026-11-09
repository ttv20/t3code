import { useRelativeTimeState } from "../hooks/useRelativeTimeState";
import { useUiLanguage } from "../i18n";

// Use a live clock because the compiler caches inline formatting on the timestamp.
export function RelativeTime(props: { timestamp: string }) {
  const { locale } = useUiLanguage();
  const relative = useRelativeTimeState(props.timestamp, locale);
  if (relative.status !== "relative") return null;
  return relative.suffix ? `${relative.value} ${relative.suffix}` : relative.value;
}
