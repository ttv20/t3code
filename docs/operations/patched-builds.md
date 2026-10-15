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
builds are uploaded. macOS Apple Silicon/Intel installers and the Android ARM64
APK build independently and attach their files to the same release. Their
failures do not block the Windows/Linux release.
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

## Additional platforms

macOS builds use GitHub-hosted Apple Silicon and Intel runners and the shared
desktop packaging workflow. The fork does not provide Apple signing or
notarization credentials; macOS may require **System Settings → Privacy &
Security → Open Anyway** for the downloaded app.

Android builds a standalone release APK with package ID `com.ttv20.t3code.rtl`,
so it can coexist with the upstream app. It includes its JavaScript bundle and
does not need Metro or an Expo account. Upstream Expo OTA updates are disabled;
install a newer APK from the releases page to update it.

The APK signing key is stored in the repository secrets
`T3CODE_ANDROID_KEYSTORE_BASE64` (PKCS12, alias `T3CodeRTL`) and
`T3CODE_ANDROID_KEYSTORE_PASSWORD` (store and key password). Retain this key for
future builds so installed apps accept updates. The workflow uses its increasing
run number as Android's version code and verifies the package ID, release mode,
bundled JavaScript, and APK signature before publishing.
