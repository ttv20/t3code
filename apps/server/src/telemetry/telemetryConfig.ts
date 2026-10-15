import * as Config from "effect/Config";

declare const __T3CODE_BUILD_POSTHOG_KEY__: string | undefined;
declare const __T3CODE_BUILD_POSTHOG_HOST__: string | undefined;
declare const __T3CODE_BUILD_TELEMETRY_ENABLED__: boolean | undefined;

const buildTimeTelemetry = {
  posthogKey:
    typeof __T3CODE_BUILD_POSTHOG_KEY__ === "undefined" ? "" : __T3CODE_BUILD_POSTHOG_KEY__,
  posthogHost:
    typeof __T3CODE_BUILD_POSTHOG_HOST__ === "undefined"
      ? "https://us.i.posthog.com"
      : __T3CODE_BUILD_POSTHOG_HOST__,
  enabled:
    typeof __T3CODE_BUILD_TELEMETRY_ENABLED__ === "undefined"
      ? false
      : __T3CODE_BUILD_TELEMETRY_ENABLED__,
};

/** Runtime settings override the public ingestion destination embedded by release builds. */
export function makeTelemetryConfig(defaults = buildTimeTelemetry) {
  return Config.all({
    posthogKey: Config.String("T3CODE_POSTHOG_KEY").pipe(Config.withDefault(defaults.posthogKey)),
    posthogHost: Config.String("T3CODE_POSTHOG_HOST").pipe(
      Config.withDefault(defaults.posthogHost),
    ),
    enabled: Config.Boolean("T3CODE_TELEMETRY_ENABLED").pipe(Config.withDefault(defaults.enabled)),
    flushBatchSize: Config.Number("T3CODE_TELEMETRY_FLUSH_BATCH_SIZE").pipe(Config.withDefault(20)),
    maxBufferedEvents: Config.Number("T3CODE_TELEMETRY_MAX_BUFFERED_EVENTS").pipe(
      Config.withDefault(1_000),
    ),
    wslDistroName: Config.String("WSL_DISTRO_NAME").pipe(Config.option),
  });
}
