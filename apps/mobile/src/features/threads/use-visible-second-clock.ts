import { useIsFocused } from "@react-navigation/native";
import { useEffect, useLayoutEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Retained routes stay mounted when hidden, so an ungated interval would keep
 * re-rendering them.
 */
export function useVisibleSecondClock(enabled: boolean, intervalMs = 1_000): number {
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(() => AppState.currentState === "active");
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    // oxlint-disable-next-line react/set-state-in-effect -- Syncs state the listener missed.
    setAppActive(AppState.currentState === "active");
    return () => subscription.remove();
  }, []);
  const ticking = enabled && focused && appActive;
  useLayoutEffect(() => {
    if (!ticking) return;
    // oxlint-disable-next-line react/set-state-in-effect -- Resuming reads the clock that stood still.
    setNowMs(Date.now());
    const intervalId = setInterval(() => setNowMs(Date.now()), intervalMs);
    return () => clearInterval(intervalId);
  }, [ticking, intervalMs]);
  return nowMs;
}
