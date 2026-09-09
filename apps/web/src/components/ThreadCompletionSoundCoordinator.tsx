import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useEffect, useRef } from "react";

import { useClientSettings } from "../hooks/useSettings";
import {
  advanceCompletionSoundSnapshot,
  playCompletionSound,
  primeCompletionSound,
  type CompletionSoundSnapshot,
} from "../lib/completionSound";
import { useAllEnvironmentShellsBootstrapped, useThreadShells } from "../state/entities";

export function ThreadCompletionSoundCoordinator() {
  const enabled = useClientSettings((settings) => settings.completionSoundEnabled);
  const threads = useThreadShells();
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const snapshotRef = useRef<CompletionSoundSnapshot | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const prime = () => {
      primeCompletionSound();
      window.removeEventListener("pointerdown", prime, true);
      window.removeEventListener("keydown", prime, true);
    };
    window.addEventListener("pointerdown", prime, true);
    window.addEventListener("keydown", prime, true);
    return () => {
      window.removeEventListener("pointerdown", prime, true);
      window.removeEventListener("keydown", prime, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!bootstrapped) return;
    const result = advanceCompletionSoundSnapshot(
      snapshotRef.current,
      threads.map((thread) => ({
        key: scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)),
        latestTurn: thread.latestTurn,
      })),
    );
    snapshotRef.current = result.snapshot;
    if (enabled && result.completed) playCompletionSound();
  }, [bootstrapped, enabled, threads]);

  return null;
}
