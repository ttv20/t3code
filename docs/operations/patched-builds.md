# Installing the patched fork

The `patched` branch in `ttv20/t3code` carries the changes described in
`PATCH.md`. Upstream remains the local `origin` remote; `fork` points to
`ttv20/t3code`. Merge upstream into `patched` and resolve overlapping features
before pushing. The fork build runs on pushes to `patched` or manual dispatch.

## Install on another computer

The fork publishes a self-contained Linux x64 archive. It does not need Node,
Bun, npm, or a compiler on the target computer. Install the latest personal
nightly with:

```sh
curl -fsSL https://raw.githubusercontent.com/ttv20/t3code/patched/scripts/install.sh \
  | T3CODE_CHANNEL=nightly sh
```

The installer puts the complete runtime below `~/.t3/runtime/versions` and a
`t3` link in `~/.local/bin`. Install and authenticate provider CLIs separately.
Project directories and conversation history are not included.

Run `t3 service install` to install and start the user service. The fork points
its built-in update checks at `ttv20/t3code`, so `t3 update` and service updates
stay on personal releases instead of replacing the build with upstream.

## Build workflow

The workflow uses standard Ubuntu and Windows runners with dependency caching.
It builds the web client, server single-executable, resource monitor, and Linux
x64 self-contained archive, then packages Linux x64 and Windows x64 desktop
clients. The release becomes the public latest release after both desktop
builds are uploaded.
No provider credentials or T3 database are required. The fork's inherited
upstream workflows are disabled in GitHub.

## PostHog for distributed builds

In PostHog US, create or select the fork's project and copy its **Project token**
from **Settings → Project**. Use the public ingestion token starting with `phc_`.

In the GitHub repository, open **Settings → Secrets and variables → Actions**:

| Type                | Name                       | Value                                    |
| ------------------- | -------------------------- | ---------------------------------------- |
| Repository secret   | `T3CODE_POSTHOG_KEY`       | The project's `phc_` token               |
| Repository variable | `T3CODE_POSTHOG_HOST`      | `https://us.i.posthog.com`               |
| Repository variable | `T3CODE_TELEMETRY_ENABLED` | `true` to enable collection in the build |

Push to `patched` or manually run **Build patched T3** after these code changes
are merged. The workflow embeds these defaults in the server bundled with the
Windows, Linux, and npm/Bun release artifacts. Updating GitHub settings does not
change artifacts that were already built. The ingestion token is public in the
distributed binary even though GitHub stores its source value as a secret.

At runtime, `T3CODE_POSTHOG_KEY` and `T3CODE_POSTHOG_HOST` can override the build's
destination. `T3CODE_TELEMETRY_ENABLED=false` disables collection, including in
builds that enable it by default. Source builds and releases without a configured
project token send no product usage events.
