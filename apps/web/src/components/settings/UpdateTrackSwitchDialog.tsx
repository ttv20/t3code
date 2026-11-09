import { useAtomValue } from "@effect/atom-react";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { DesktopUpdateChannel } from "@t3tools/contracts";
import { acceptsTrackSwitchRelease, desktopUpdateChannelOf } from "@t3tools/shared/cliRelease";
import { isMacPlatform } from "@t3tools/shared/keybindings";
import { AsyncResult } from "effect/reactivity";
import { useState } from "react";
import { UiText, useUiLanguage } from "../../i18n";

import { APP_VERSION } from "~/branding";
import { useDesktopUpdateState } from "~/state/desktopUpdate";
import { useEnvironments } from "~/state/environments";
import { forkTrackReleaseAtom } from "~/state/forkRelease";
import { downloadLocalUpdate, installLocalUpdate } from "../sidebar/SidebarUpdatePill";
import { UpdateEverythingDialog } from "../sidebar/UpdateEverythingDialog";
import {
  channelSwitchLabel,
  localSwitchBlockReason,
  type ChannelSwitchRelease,
} from "../sidebar/updateEverything.logic";
import { isHostedByThisApp, useUpdateEverything } from "../sidebar/useUpdateEverything";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { localUpdaterStaysPut, prepareLocalTrackSwitch } from "./updateTrackSwitch.logic";

/** Moves this app and every connected machine to `channel`. */
export function UpdateTrackSwitchDialog({
  channel,
  onClose,
}: {
  readonly channel: DesktopUpdateChannel;
  readonly onClose: () => void;
}) {
  const { t: uiT } = useUiLanguage();
  const release = useAtomValue(forkTrackReleaseAtom(channel));
  if (AsyncResult.isSuccess(release) && release.value !== null) {
    return <SwitchPlan release={{ channel, ...release.value }} onClose={onClose} />;
  }
  const label = uiT(channelSwitchLabel(channel));
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{uiT("Switch to {0}", { "0": label })}</AlertDialogTitle>
          <AlertDialogDescription>
            {AsyncResult.isFailure(release)
              ? uiT("Could not check this fork’s GitHub releases. Try again later.")
              : AsyncResult.isSuccess(release)
                ? uiT("No {0} release has been published by this fork.", { "0": label })
                : uiT("Checking releases…")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="outline" />}>
            <UiText message={"Cancel"} />
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}

function SwitchPlan({
  release,
  onClose,
}: {
  readonly release: ChannelSwitchRelease;
  readonly onClose: () => void;
}) {
  const { t: uiT, locale } = useUiLanguage();
  const updateState = useDesktopUpdateState();
  const { environments } = useEnvironments();
  const crossesLocal = desktopUpdateChannelOf(APP_VERSION) !== release.channel;
  const updatesOff = localUpdaterStaysPut(updateState, release.channel);
  // After a partial switch this app may already be on the track; then only remotes move.
  const switchesLocal = crossesLocal && !updatesOff;
  const [checking, setChecking] = useState(false);
  const everything = useUpdateEverything(switchesLocal ? release.version : null, release);
  const label = uiT(channelSwitchLabel(release.channel));
  // This app's reinstall restarts every server it hosts, so each of their databases must allow it.
  const localBlocked = localSwitchBlockReason(
    APP_VERSION,
    release,
    environments.filter(isHostedByThisApp).map((environment) => ({
      connected: environment.connection.phase === "connected",
      databaseMigration: environment.serverConfig?.environment.databaseMigration,
    })),
    window.desktopBridge?.getLocalEnvironmentBootstraps().length ?? 0,
    locale,
  );

  const run = async () => {
    const bridge = window.desktopBridge;
    if (!bridge) return;
    // Stay open while the feed is checked; the run's own progress takes over after.
    setChecking(true);
    const fail = (description: string) =>
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: uiT("Could not switch to {0}", { "0": label }),
          description,
        }),
      );
    const prepared = await prepareLocalTrackSwitch(
      bridge,
      {
        channel: release.channel,
        version: release.version,
        reinstall: switchesLocal,
      },
      locale,
    );
    onClose();
    if (!prepared.ok) {
      fail(prepared.message);
      return;
    }
    const { local } = prepared;
    const result = await settlePromise(() =>
      everything.run(
        local === null
          ? {}
          : {
              ...(local.status === "available"
                ? {
                    downloadLocal: (reportError) =>
                      downloadLocalUpdate(bridge, { notifyDownloaded: false, reportError }),
                  }
                : {}),
              // Install only a build the database check covers, pinned so nothing replaces it.
              installLocal: async (reportError) => {
                const { downloadedVersion } = await bridge.getUpdateState();
                if (
                  downloadedVersion === null ||
                  !acceptsTrackSwitchRelease(downloadedVersion, release.channel, release.version)
                ) {
                  reportError(
                    uiT("Could not install update"),
                    uiT("This app downloaded {0}, not {1} or newer.", {
                      "0": downloadedVersion ?? uiT("nothing"),
                      "1": release.version,
                    }),
                  );
                  return false;
                }
                return installLocalUpdate(bridge, reportError, downloadedVersion);
              },
            },
      ),
    );
    if (result._tag === "Failure") {
      const error = squashAtomCommandFailure(result);
      fail(error instanceof Error ? error.message : uiT("An unexpected error occurred."));
    }
  };

  return (
    <UpdateEverythingDialog
      open
      onOpenChange={(open) => !open && !checking && onClose()}
      title={uiT("Switch to {0}?", { "0": label })}
      version={release.version}
      providerCount={0}
      rows={everything.rows}
      notes={[
        ...(everything.rows.length === 0 && !crossesLocal
          ? [
              uiT("Every connected machine is already on {0}. This only saves the track.", {
                "0": label,
              }),
            ]
          : []),
        ...(crossesLocal && updatesOff
          ? [uiT("This app's updates are off here, so reinstall it yourself to switch.")]
          : []),
        ...(switchesLocal && isMacPlatform(navigator.platform)
          ? [uiT("If T3 Code does not reopen after it restarts, open it again.")]
          : []),
      ]}
      restarts={everything.restarts}
      confirmLabel={checking ? uiT("Checking…") : uiT("Switch to {0}", { "0": label })}
      busy={checking}
      disabledReason={
        !switchesLocal || localBlocked === null
          ? null
          : uiT("This app cannot switch: {0}.", { "0": localBlocked })
      }
      onConfirm={() => void run()}
    />
  );
}
