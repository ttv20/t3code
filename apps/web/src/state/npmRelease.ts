import { ServerNpmReleaseError } from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { msg } from "gt-react";
import { m, type MessageResolver } from "../i18n/messages";
import { forkTrackReleaseAtom } from "./forkRelease";

const isServerNpmReleaseError = Schema.is(ServerNpmReleaseError);

export function npmReleaseFailureMessage(
  cause: Cause.Cause<unknown>,
  resolve: MessageResolver = m,
): string {
  const error = Option.getOrUndefined(Cause.findErrorOption(cause));
  return isServerNpmReleaseError(error)
    ? error.message
    : resolve(msg("Could not check this fork’s GitHub releases. Try again later."));
}

export const npmReleaseAtom = forkTrackReleaseAtom;
