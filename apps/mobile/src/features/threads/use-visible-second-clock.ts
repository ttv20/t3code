import { useIsFocused } from "@react-navigation/native";
import { secondTick, minuteTick } from "@t3tools/client-runtime/clock";
import { useSyncExternalStore } from "react";

import { useAppActive } from "../../lib/appState";

const subscribeNever = () => () => undefined;

/**
 * Retained routes stay mounted when hidden, so an ungated tick would keep
 * re-rendering them. Every visible label shares one module-level tick.
 */
export function useVisibleSecondClock(enabled: boolean, periodMs = 1000): number {
  const focused = useIsFocused();
  const appActive = useAppActive();
  const ticking = enabled && focused && appActive;
  // While paused the snapshot still reads the shared tick, so resuming shows
  // the current second rather than the one the clock stopped on.
  const clock = periodMs >= 60_000 ? minuteTick : secondTick;
  const value = useSyncExternalStore<number | string>(
    ticking ? clock.subscribe : subscribeNever,
    clock.getSnapshot,
    clock.getSnapshot,
  );
  return typeof value === "number" ? value : Date.parse(`${value}:00Z`);
}
