import type { DesktopUpdateChannel } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import {
  CLI_ARCHIVE_PLATFORM_KEYS,
  CLI_RELEASE_CHECKSUMS_FILE,
  cliArchiveFileName,
  cliReleaseTagUrl,
  cliReleaseIndexPageUrl,
  cliReleaseChannelOf,
} from "@t3tools/shared/cliRelease";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";
import { AsyncResult, Atom } from "effect/reactivity";

const Release = Schema.Struct({
  tag_name: Schema.String,
  draft: Schema.Boolean,
  assets: Schema.Array(Schema.Struct({ name: Schema.String })),
});

/**
 * Whether the fork release has a downloadable CLI archive and checksums.
 * A 404 is false; network and API errors stay unknown. Re-check every few
 * minutes, so a release that lands later shows up without a reload.
 */
export const forkReleasePublishedAtom = Atom.family((version: string) =>
  Atom.make(
    Effect.gen(function* () {
      const response = yield* HttpClient.get(cliReleaseTagUrl(version));
      if (response.status === 404) return false;
      const release = yield* HttpClientResponse.filterStatusOk(response).pipe(
        Effect.flatMap((ok) => ok.json),
        Effect.flatMap(Schema.decodeUnknownEffect(Release)),
      );
      const assets = new Set(release.assets.map((asset) => asset.name));
      return (
        !release.draft &&
        release.tag_name === `v${version}` &&
        assets.has(CLI_RELEASE_CHECKSUMS_FILE) &&
        CLI_ARCHIVE_PLATFORM_KEYS.some((platform) =>
          assets.has(cliArchiveFileName(version, platform)),
        )
      );
    }).pipe(
      // Public release checks need no tracing headers or CORS preflight.
      Effect.provideService(HttpClient.TracerPropagationEnabled, false),
      Effect.provide(FetchHttpClient.layer),
    ),
  ).pipe(
    Atom.withRefresh("5 minutes"),
    Atom.keepAlive,
    Atom.withLabel(`fork-release-published:${version}`),
  ),
);

const NO_VERSION_ATOM = Atom.make(AsyncResult.success(false)).pipe(
  Atom.withLabel("fork-release-published:none"),
);

/** True only once GitHub has the version's CLI assets, so callers can hide work that
    would download it until then. */
export function useForkReleasePublished(version: string | null): boolean {
  const result = useAtomValue(version ? forkReleasePublishedAtom(version) : NO_VERSION_ATOM);
  return AsyncResult.getOrElse(result, () => false);
}

export const lookupForkTrackRelease = Effect.fn("ForkRelease.lookupTrack")(
  function* (channel: DesktopUpdateChannel) {
    for (let page = 1; page <= 10; page += 1) {
      const response = yield* HttpClient.get(cliReleaseIndexPageUrl(page)).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
      );
      const releases = yield* response.json.pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(Release))),
      );
      for (const release of releases) {
        const version = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(release.tag_name)?.[1];
        if (
          release.draft ||
          version === undefined ||
          cliReleaseChannelOf(version) !== (channel === "latest" ? "stable" : "nightly")
        )
          continue;
        const assets = new Set(release.assets.map((asset) => asset.name));
        if (
          assets.has(CLI_RELEASE_CHECKSUMS_FILE) &&
          CLI_ARCHIVE_PLATFORM_KEYS.some((platform) =>
            assets.has(cliArchiveFileName(version, platform)),
          )
        ) {
          return { version };
        }
      }
      if (releases.length < 100) break;
    }
    return null;
  },
  Effect.provideService(HttpClient.TracerPropagationEnabled, false),
  Effect.provide(FetchHttpClient.layer),
);

export const forkTrackReleaseAtom = Atom.family((channel: DesktopUpdateChannel) =>
  Atom.make(lookupForkTrackRelease(channel)).pipe(
    Atom.withRefresh("5 minutes"),
    Atom.withLabel(`fork-track-release:${channel}`),
  ),
);
