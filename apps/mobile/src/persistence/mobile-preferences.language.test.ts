import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { vi } from "vite-plus/test";

vi.mock("expo-sqlite", () => ({}));
vi.mock("expo-secure-store", () => ({}));

import * as MobileDatabase from "./mobile-database";
import * as MobilePreferences from "./mobile-preferences";
import * as MobileSecureStorage from "./mobile-secure-storage";

describe("saved interface language", () => {
  it.effect.each(["system", "en", "he", "ar", "fa"] as const)(
    "restores %s after creating a new preferences store",
    (language) =>
      Effect.gen(function* () {
        let saved: MobileDatabase.StoredPreferencesJson | null = null;
        const dependencies = Layer.mergeAll(
          Layer.mock(MobileDatabase.MobileDatabase)({
            loadPreferencesJson: Effect.sync(() =>
              saved === null ? Option.none() : Option.some(saved),
            ),
            savePreferencesJson: (payload, updatedAt) =>
              Effect.sync(() => {
                saved = { payload, updatedAt };
              }),
          }),
          Layer.mock(MobileSecureStorage.MobileSecureStorage)({
            getItem: () => Effect.succeed(null),
            removeItem: () => Effect.void,
          }),
        );
        yield* Effect.gen(function* () {
          const first = yield* MobilePreferences.MobilePreferencesStore.pipe(
            Effect.provide(MobilePreferences.layer),
          );
          yield* first.savePatch({ interfaceLanguage: language, interfaceDirection: "auto" });
          const reopened = yield* MobilePreferences.MobilePreferencesStore.pipe(
            Effect.provide(MobilePreferences.layer),
          );
          expect(yield* reopened.load).toMatchObject({
            interfaceLanguage: language,
            interfaceDirection: "auto",
          });
        }).pipe(Effect.provide(dependencies));
      }),
  );
});
