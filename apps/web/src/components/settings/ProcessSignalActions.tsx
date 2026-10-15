import { useUiLanguage } from "../../i18n";
import type { ServerProcessSignal } from "@t3tools/contracts";

import { InlineButton } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** Process ownership and confirmation stay with the diagnostics view. */
export function ProcessSignalActions({
  disabled,
  onSignal,
}: {
  disabled: boolean;
  onSignal: (signal: ServerProcessSignal) => void;
}) {
  const { t: uiT } = useUiLanguage();
  return (
    <div className="flex items-center justify-end gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={uiT("Send SIGINT")}
              tone="muted"
              onClick={() => onSignal("SIGINT")}
            >
              {uiT("INT")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{uiT("Send SIGINT")}</TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <InlineButton
              disabled={disabled}
              aria-label={uiT("Send SIGKILL")}
              tone="destructive"
              onClick={() => onSignal("SIGKILL")}
            >
              {uiT("KILL")}
            </InlineButton>
          }
        />
        <TooltipPopup side="top">{uiT("Send SIGKILL")}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
