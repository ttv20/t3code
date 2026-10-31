import { useUiLanguage } from "../i18n";
import { useSyncExternalStore } from "react";
import { msUntilRelativeTimeChange, relativeTime } from "../lib/time";

// The React Compiler caches inline relativeTime calls on the timestamp alone.
export function RelativeTime(props: { timestamp: string }) {
  const { t } = useUiLanguage();
  const subscribe = (onChange: () => void) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delayMs = msUntilRelativeTimeChange(props.timestamp);
      if (delayMs === null) return;
      timer = setTimeout(() => {
        onChange();
        schedule();
      }, delayMs);
    };
    schedule();
    return () => clearTimeout(timer);
  };
  const getSnapshot = () => {
    const value = relativeTime(props.timestamp);
    const match = /^(<)?(\d+)([mhd])$/.exec(value);
    if (!match) return value;
    const labels = { m: "{0}m", h: "{0}h", d: "{0}d" } as const;
    const unit = match[3] as keyof typeof labels;
    return `${match[1] ?? ""}${t(labels[unit], { "0": match[2] })}`;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
