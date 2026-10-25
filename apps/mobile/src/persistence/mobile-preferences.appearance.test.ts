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

describe("saved chat typography", () => {
  it.effect.each([
    [14, 28],
    [null, null],
  ] as const)(
    "restores %s after creating a new preferences store",
    ([chatFontSize, chatLineHeight]) =>
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
          const first = yield* MobilePreferences.make();
          yield* first.savePatch({ chatFontSize, chatLineHeight });
          const reopened = yield* MobilePreferences.make();
          expect(yield* reopened.load).toMatchObject({
            chatFontSize,
            chatLineHeight,
          });
        }).pipe(Effect.provide(dependencies));
      }),
  );
});
