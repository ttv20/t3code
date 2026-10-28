import { useUiLanguage } from "../../i18n";
import { useState } from "react";

import {
  desktopCliCommandStateAtom,
  getDesktopCliCommandBridge,
  refreshDesktopCliCommandState,
} from "~/state/desktopCliCommand";
import { useEnvironmentQuery } from "~/state/query";
import { Button } from "../ui/button";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

export function CliCommandSettingsRow() {
  const { t: uiT } = useUiLanguage();

  const bridge = getDesktopCliCommandBridge();
  const query = useEnvironmentQuery(bridge ? desktopCliCommandStateAtom : null);
  const state = query.data;
  const [pending, setPending] = useState(false);

  const change = (action: "install" | "uninstall") => {
    if (!bridge || pending) return;
    setPending(true);
    void bridge[action]()
      .then(refreshDesktopCliCommandState)
      .catch((error: unknown) => {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: action === "install" ? uiT("Could not install t3") : uiT("Could not remove t3"),
            description: error instanceof Error ? error.message : uiT("Something went wrong."),
          }),
        );
      })
      .finally(() => setPending(false));
  };

  if (!bridge || !state?.supported) return null;
  const installed = state.installedPath !== null;
  const description = state.shadowedBy
    ? uiT("Another t3 at {0} runs first in a new terminal. Remove it to use T3 Code's.", {
        "0": state.shadowedBy,
      })
    : !installed
      ? uiT("Run T3 Code's CLI as `t3` from any terminal.")
      : state.onPath
        ? uiT("Installed at {0}. Open a new terminal to use it.", { "0": state.installedPath })
        : uiT(
            "Installed at {0}, which is not on your PATH yet. Add its folder to your PATH to run `t3`.",
            { "0": state.installedPath },
          );

  return (
    <SettingsRow
      {...searchableSetting("cli-command")}
      description={uiT(description)}
      control={
        <Button
          size="sm"
          variant="outline"
          disabled={pending || query.isPending}
          onClick={() => change(installed ? "uninstall" : "install")}
        >
          {installed ? uiT("Remove") : uiT("Install")}
        </Button>
      }
    />
  );
}
