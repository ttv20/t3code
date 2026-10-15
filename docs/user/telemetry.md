# Product usage data

When enabled, the T3 Code server sends product usage events to PostHog, associated with a hashed
account or installation identifier. Events include the provider, model, reasoning effort,
permission mode, turn result, duration, and main-agent token totals when available.

Events do not include prompts, responses, file contents, authentication tokens, conversation IDs,
raw provider events, or child-agent output. Child-agent token use is excluded from the totals.

Collection is disabled by default in source builds. Release builds can include a
PostHog project and enable collection by default. Set `T3CODE_TELEMETRY_ENABLED=false`
in the server's environment to disable it, or `true` to enable it when a project
token is configured.

The desktop app reads the variable from your shell profile (for example `~/.zshrc`) on macOS and
Linux, so export it there and restart the app. On Windows, set it as a user environment variable.

To send these events to your own PostHog project, also set `T3CODE_POSTHOG_KEY` to that
project's ingestion key and `T3CODE_POSTHOG_HOST` to its ingestion endpoint. PostHog US
uses `https://us.i.posthog.com`, which is the default host. Restart the server or desktop
app after changing these variables. These settings apply to the server receiving the
client's connection, including when the client connects remotely.

## Export diagnostics to your own receiver

To send traces, metrics, or logs to an OpenTelemetry receiver, open
**Settings > General > Diagnostics**, select an environment, and enter each signal's OTLP HTTP
endpoint under **OpenTelemetry export** (for example `http://localhost:4318/v1/traces`). Save, then
restart that environment's server. The receiver must be reachable from the server's machine.
**Test** sends an empty export from the server to check an endpoint before or after you save it;
saved endpoints are checked when the section opens. Checks send authentication headers only to
the signal's currently running endpoint and do not follow redirects. To check a new endpoint
that requires authentication, save it and restart the server first.

`T3CODE_OTLP_*_URL` and standard `OTEL_EXPORTER_OTLP_*` environment variables override the saved
settings. For endpoints saved here or set with `T3CODE_OTLP_*_URL`, set `T3CODE_OTLP_HEADERS` for
receivers that need authentication and `T3CODE_OTLP_PROTOCOL=http/protobuf` for receivers that do
not accept JSON. An endpoint set with `OTEL_EXPORTER_OTLP_*` takes its headers and protocol from
`OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_EXPORTER_OTLP_PROTOCOL` instead.
