# Installing the patched fork

The `patched` branch in `ttv20/t3code` carries the changes described in
`PATCH.md`. Upstream remains the local `origin` remote; `fork` points to
`ttv20/t3code`. Merge upstream into `patched` and resolve overlapping features
before pushing. The fork build runs on pushes to `patched` or manual dispatch.

## Install on another computer

Install Node 24.13.1 or a newer Node 24 release. Download the `.tgz` from
https://github.com/ttv20/t3code/releases/latest, then run:

```sh
bun add -g "t3@./<downloaded-file>.tgz"
t3 serve
```

Use the specific downloaded filename if the directory contains multiple builds.
The package contains the compiled web and server. npm installs runtime
dependencies for the target platform; it does not rebuild the T3 web app.
Install and authenticate the provider CLIs on that computer separately.
Project directories and conversation history are not included in the package.

On Linux or macOS, run `t3 service install` to install and start a background
service. On Windows, run `t3 serve` in a terminal. To update an existing service,
install the new package with Bun and run `t3 service update` when ready to restart it.
Use fork release downloads for updates; official T3 releases omit these patches.

## Build workflow

The workflow uses a standard Ubuntu runner with dependency caching. It builds
only web and server, verifies a standalone npm installation, and uploads the
package as a GitHub Release asset. No provider credentials or T3 database are
required. The fork's inherited upstream workflows are disabled in GitHub.
