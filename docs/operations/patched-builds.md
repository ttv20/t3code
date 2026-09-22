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

The workflow uses a standard Ubuntu runner with dependency caching. It builds
the web client, server single-executable, resource monitor, and Linux x64
self-contained archive, then uploads the archive and checksums as a prerelease.
No provider credentials or T3 database are required. The fork's inherited
upstream workflows are disabled in GitHub.
