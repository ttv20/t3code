import * as Effect from "effect/Effect";
import * as Semaphore from "effect/Semaphore";
import { Atom } from "effect/reactivity";
import * as MobileSecureStorage from "../persistence/mobile-secure-storage";

const KEY = "t3code.sticky-working-shelf.v1";

export function createStickyWorkingShelfState(
  runtime: Atom.AtomRuntime<MobileSecureStorage.MobileSecureStorage>,
) {
  const lock = Semaphore.makeUnsafe(1);
  const enabledAtom = runtime
    .atom(
      MobileSecureStorage.MobileSecureStorage.use((store) => store.getItem(KEY)).pipe(
        Effect.map((value) => value === "true"),
      ),
    )
    .pipe(Atom.keepAlive, Atom.withLabel("mobile:sticky-working-shelf"));
  const updateAtom = runtime
    .fn(
      (enabled: boolean, get) =>
        lock.withPermit(
          MobileSecureStorage.MobileSecureStorage.use((store) =>
            store.setItem(KEY, String(enabled)),
          ).pipe(Effect.tap(() => Effect.sync(() => get.refresh(enabledAtom)))),
        ),
      { concurrent: true },
    )
    .pipe(Atom.keepAlive);
  return { enabledAtom, updateAtom };
}

const state = createStickyWorkingShelfState(Atom.runtime(MobileSecureStorage.layer));
export const stickyWorkingShelfAtom = state.enabledAtom;
export const updateStickyWorkingShelfAtom = state.updateAtom;
