import { expect, it } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Atom, AtomRegistry } from "effect/reactivity";
import { vi } from "vite-plus/test";

vi.mock("expo-secure-store", () => ({}));

import * as MobileSecureStorage from "../persistence/mobile-secure-storage";
import { createStickyWorkingShelfState } from "./sticky-working-shelf";

it.effect("preserves the last device-only choice across queued writes and a fresh state", () =>
  Effect.gen(function* () {
    const values = new Map<string, string>();
    const entered = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const saved = yield* Deferred.make<void>();
    let writes = 0;
    const store = MobileSecureStorage.MobileSecureStorage.of({
      getItem: (key) => Effect.sync(() => values.get(key) ?? null),
      setItem: (key, value) =>
        Effect.gen(function* () {
          const write = ++writes;
          if (write === 1) {
            yield* Deferred.succeed(entered, undefined);
            yield* Deferred.await(release);
          }
          values.set(key, value);
          if (write === 2) yield* Deferred.succeed(saved, undefined);
        }),
      removeItem: (key) =>
        Effect.sync(() => {
          values.delete(key);
        }),
    });
    const make = () =>
      createStickyWorkingShelfState(
        Atom.runtime(Layer.succeed(MobileSecureStorage.MobileSecureStorage, store)),
      );
    const state = make();
    const registry = AtomRegistry.make();
    const unmount = registry.mount(state.enabledAtom);
    const unmountSave = registry.mount(state.updateAtom);
    try {
      expect(yield* AtomRegistry.getResult(registry, state.enabledAtom)).toBe(false);
      registry.set(state.updateAtom, true);
      yield* Deferred.await(entered);
      registry.set(state.updateAtom, false);
      yield* Deferred.succeed(release, undefined);
      yield* Deferred.await(saved);
      expect(writes).toBe(2);
      expect([...values.values()]).toEqual(["false"]);
      const fresh = make();
      expect(yield* AtomRegistry.getResult(registry, fresh.enabledAtom)).toBe(false);
      registry.set(fresh.updateAtom, true);
      yield* AtomRegistry.getResult(registry, fresh.updateAtom, { suspendOnWaiting: true });
      expect(yield* AtomRegistry.getResult(registry, make().enabledAtom)).toBe(true);
    } finally {
      unmountSave();
      unmount();
      registry.dispose();
    }
  }),
);
