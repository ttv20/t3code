import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef } from "react";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";
import { ANCHORED_COPY_TOAST_TIMEOUT_MS, showAnchoredCopyErrorToast } from "./ui/anchoredCopyToast";
import { Button } from "./ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

import { useUiLanguage } from "../i18n";

export function DiffFilePathCopyButton({ filePath }: { filePath: string }) {
  const { t: uiT } = useUiLanguage();
  const ref = useRef<HTMLButtonElement>(null);
  const { copyToClipboard, isCopied } = useCopyToClipboard<void>({
    onError: (error) => showAnchoredCopyErrorToast(ref, error),
    timeout: ANCHORED_COPY_TOAST_TIMEOUT_MS,
  });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            ref={ref}
            size="icon-micro"
            variant="ghost-muted"
            aria-label={uiT("Copy file path")}
            onClick={() => copyToClipboard(filePath, undefined)}
          />
        }
      >
        {isCopied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
      </TooltipTrigger>
      <TooltipPopup>
        <p>{isCopied ? uiT("Copied") : uiT("Copy path")}</p>
      </TooltipPopup>
    </Tooltip>
  );
}
