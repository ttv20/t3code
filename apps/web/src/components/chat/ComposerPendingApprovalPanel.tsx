import { useUiLanguage } from "../../i18n";
import {
  FULL_ACCESS_OVERRIDE_QUESTION,
  fullAccessOverrideExplanation,
} from "@t3tools/client-runtime/state/thread-requests";
import { memo } from "react";
import { type PendingApproval } from "../../session-logic";
import { InlineButton } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { composerFloatingLayerProps } from "./composerEventScope";
import { cn } from "~/lib/utils";

interface ComposerPendingApprovalPanelProps {
  approval: PendingApproval;
  pendingCount: number;
  className?: string;
}

export const ComposerPendingApprovalPanel = memo(function ComposerPendingApprovalPanel({
  approval,
  pendingCount,
  className,
}: ComposerPendingApprovalPanelProps) {
  const { t: uiT } = useUiLanguage();

  const Detail = approval.requestKind === "mcp-elicitation" ? "span" : "code";
  const fallbackLabel =
    approval.requestKind === "mcp-elicitation"
      ? uiT("App access approval")
      : approval.requestKind === "command"
        ? uiT("Command approval")
        : approval.requestKind === "file-read"
          ? uiT("File read approval")
          : approval.requestKind === "permission"
            ? uiT("App permission approval")
            : uiT("File change approval");
  const detailAriaLabel =
    approval.requestKind === "mcp-elicitation"
      ? uiT("App access request")
      : approval.requestKind === "command"
        ? uiT("Command")
        : approval.requestKind === "file-read"
          ? uiT("File to read")
          : approval.requestKind === "permission"
            ? uiT("Permission request")
            : uiT("File change");

  return (
    <span
      aria-label={fallbackLabel}
      className={cn("flex min-w-0 flex-1 flex-col items-start gap-1", className)}
      role="group"
    >
      <span className="flex w-full min-w-0 items-center gap-2 text-2xs text-muted-foreground">
        <span className="shrink-0 font-medium text-warning">{fallbackLabel}</span>
        {approval.appName ? <span className="min-w-0 truncate">{approval.appName}</span> : null}
        {approval.fullAccessOverride ? (
          <Popover>
            <PopoverTrigger openOnHover render={<InlineButton tone="muted" />}>
              {uiT(FULL_ACCESS_OVERRIDE_QUESTION)}
            </PopoverTrigger>
            <PopoverPopup
              {...composerFloatingLayerProps}
              aria-label={uiT(FULL_ACCESS_OVERRIDE_QUESTION)}
              tooltipStyle
              side="top"
              className="max-w-[min(22rem,calc(100vw-2rem))] whitespace-normal"
            >
              {uiT(fullAccessOverrideExplanation(approval.fullAccessOverride))}
            </PopoverPopup>
          </Popover>
        ) : null}
        {pendingCount > 1 ? (
          <span className="ml-auto shrink-0 tabular-nums">1/{pendingCount}</span>
        ) : null}
      </span>
      <Detail
        aria-label={detailAriaLabel}
        className={cn(
          "block w-full min-w-0 overflow-auto text-xs text-foreground [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70 [&::-webkit-scrollbar]:h-1.5",
          approval.requestKind === "mcp-elicitation"
            ? "max-h-20 whitespace-pre-wrap font-sans wrap-break-word"
            : "max-h-40 whitespace-pre-wrap font-mono wrap-anywhere",
        )}
        data-approval-detail="complete"
        tabIndex={0}
      >
        {approval.responseCapability === "not_resumable"
          ? uiT("Provider process is gone — interrupt or restart the run to respond.")
          : approval.detail || fallbackLabel}
      </Detail>
      {approval.reason ? (
        <span className="w-full min-w-0 text-2xs text-muted-foreground wrap-break-word">
          {approval.reason}
        </span>
      ) : null}
    </span>
  );
});
