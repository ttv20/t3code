// @effect-diagnostics globalFetch:off -- Release lookups run in browser and native clients without an Effect runtime.
import {
  cliReleaseChannelOf,
  cliReleaseIndexPageUrl,
  newestCliReleaseVersion,
} from "@t3tools/shared/cliRelease";
import { compareSemverVersions } from "@t3tools/shared/semver";
import * as Schema from "effect/Schema";

const Releases = Schema.Array(
  Schema.Struct({
    tag_name: Schema.String,
    draft: Schema.optionalKey(Schema.Boolean),
  }),
);
const decodeReleases = Schema.decodeUnknownSync(Releases);

/** Preserve the host's release channel and never offer a downgrade. */
export async function findEnvironmentUpdate(currentVersion: string, signal: AbortSignal) {
  const channel = cliReleaseChannelOf(currentVersion);
  for (let page = 1; ; page++) {
    const response = await fetch(cliReleaseIndexPageUrl(page), { signal });
    if (!response.ok) throw new Error(`Could not check releases (${response.status}). Try again.`);
    const releases = decodeReleases(await response.json());
    const version = newestCliReleaseVersion(releases, channel);
    if (version !== undefined) {
      return compareSemverVersions(version, currentVersion) > 0 ? version : null;
    }
    if (releases.length < 100) throw new Error(`No ${channel} release was found.`);
  }
}

/** A release lookup must not hide a newer version already offered by the client. */
export function environmentUpdateTarget(clientTarget: string | null, releaseTarget: string | null) {
  if (clientTarget === null) return releaseTarget;
  if (releaseTarget === null) return clientTarget;
  return compareSemverVersions(clientTarget, releaseTarget) > 0 ? clientTarget : releaseTarget;
}
