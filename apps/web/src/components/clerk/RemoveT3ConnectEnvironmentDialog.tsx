import { useUiLanguage, UiText } from "../../i18n";
import { Discovery } from "@t3tools/client-runtime/relay";
import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import { useRelayEnvironmentDiscovery } from "../../state/environments";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Button, InlineButton } from "../ui/button";
import { useT3ConnectAccountPage } from "./T3ConnectAccountPages";

export function RemoveT3ConnectEnvironmentDialog({
  environmentLabel,
  environmentId,
  onCancel,
  onConfirm,
}: {
  readonly environmentLabel: string | null;
  readonly environmentId: EnvironmentId | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t: uiT } = useUiLanguage();
  const accountPage = useT3ConnectAccountPage();
  const discovery = useRelayEnvironmentDiscovery();
  const registration = environmentId
    ? Discovery.relayEnvironmentRegistration(discovery, environmentId)
    : "unknown";
  const [shown, setShown] = useState({ label: environmentLabel, registration });
  if (
    environmentLabel !== null &&
    (environmentLabel !== shown.label || registration !== shown.registration)
  ) {
    setShown({ label: environmentLabel, registration });
  }
  const openAccountPage = accountPage.open;
  const accountPageLink = openAccountPage ? (
    <InlineButton
      onClick={() => {
        onCancel();
        openAccountPage();
      }}
    >
      <UiText message={"T3 Connect settings"} />
    </InlineButton>
  ) : (
    "T3 Connect settings"
  );

  return (
    <>
      <AlertDialog
        open={environmentLabel !== null}
        onOpenChange={(open) => {
          if (!open) onCancel();
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <UiText message={"Remove"} /> {shown.label} <UiText message={"from this device?"} />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("This forgets its pairing, credentials, and cached threads here.")}
            </AlertDialogDescription>
            <AlertDialogDescription>
              {shown.registration === "registered" ? (
                <>
                  <UiText
                    message={
                      "It stays on your T3 Connect account and keeps its host space. Deregister it in"
                    }
                  />{" "}
                  {accountPageLink} <UiText message={"to free it."} />
                </>
              ) : shown.registration === "unregistered" ? (
                uiT("It's no longer on your T3 Connect account.")
              ) : (
                <>
                  <UiText
                    message={
                      "This doesn't change your T3 Connect account. To deregister it there, use"
                    }
                  />{" "}
                  {accountPageLink}.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {uiT("Cancel")}
            </AlertDialogClose>
            <Button variant="destructive" onClick={onConfirm}>
              {uiT("Remove from this device")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
      {accountPage.portals}
    </>
  );
}
