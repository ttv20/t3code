import { useUiLanguage, UiText } from "../../i18n";
import { useState } from "react";

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
  onCancel,
  onConfirm,
}: {
  readonly environmentLabel: string | null;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const { t: uiT } = useUiLanguage();
  const accountPage = useT3ConnectAccountPage();
  const [shownLabel, setShownLabel] = useState(environmentLabel);
  if (environmentLabel !== null && environmentLabel !== shownLabel) setShownLabel(environmentLabel);
  const openAccountPage = accountPage.open;

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
              <UiText message={"Remove {0} from this device?"} values={{ "0": shownLabel }} />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {uiT("This forgets its pairing, credentials, and cached threads here.")}
            </AlertDialogDescription>
            <AlertDialogDescription>
              <UiText
                message={
                  "It stays on your T3 Connect account and keeps its host space. Deregister it in {0} to free it."
                }
                values={{
                  "0": openAccountPage ? (
                    <InlineButton
                      onClick={() => {
                        onCancel();
                        openAccountPage();
                      }}
                    >
                      {uiT("T3 Connect settings")}
                    </InlineButton>
                  ) : (
                    uiT("T3 Connect settings")
                  ),
                }}
              />
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
