import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { makeTelemetryConfig } from "./telemetryConfig.ts";

const build = {
  posthogKey: "phc_release_project",
  posthogHost: "https://us.i.posthog.com",
  enabled: true,
};

it.effect("uses the release project's ingestion destination on an installed server", () =>
  Effect.gen(function* () {
    const config = yield* makeTelemetryConfig(build);
    assert.equal(config.posthogKey, build.posthogKey);
    assert.equal(config.posthogHost, build.posthogHost);
    assert.equal(config.enabled, true);
  }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
);

it.effect("runtime variables can change the destination and disable a release's telemetry", () =>
  Effect.gen(function* () {
    const config = yield* makeTelemetryConfig(build);
    assert.equal(config.posthogKey, "phc_runtime_project");
    assert.equal(config.posthogHost, "https://eu.i.posthog.com");
    assert.equal(config.enabled, false);
  }).pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          T3CODE_POSTHOG_KEY: "phc_runtime_project",
          T3CODE_POSTHOG_HOST: "https://eu.i.posthog.com",
          T3CODE_TELEMETRY_ENABLED: false,
        }),
      ),
    ),
  ),
);

it.effect("source builds have no upstream key and remain disabled by default", () =>
  Effect.gen(function* () {
    const config = yield* makeTelemetryConfig();
    assert.equal(config.posthogKey, "");
    assert.equal(config.enabled, false);
  }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))),
);
