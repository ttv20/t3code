import { useUiLanguage } from "../i18n";
import type { ThreadContextRecord } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { MessagesSquareIcon } from "lucide-react";

import { useThreadShell } from "~/state/entities";
import { ContextChip, ContextChipLabel } from "./ContextChip";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/**
 * Inline chip for an attached thread, in the composer and in sent messages. Prefers the
 * live title so a renamed thread never shows a stale label, and opens the thread on click.
 */
export function ThreadContextChip(props: {
  record: Pick<ThreadContextRecord, "environmentId" | "threadId" | "title">;
  copyMarkdown?: string;
}) {
  const { t: uiT } = useUiLanguage();
  const { environmentId, threadId } = props.record;
  const shell = useThreadShell({ environmentId, threadId });
  const title = shell?.title?.trim() || props.record.title;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ContextChip
            kind="thread"
            render={<Link to="/$environmentId/$threadId" params={{ environmentId, threadId }} />}
            aria-label={uiT("Thread, {0}", { "0": title })}
            data-markdown-copy={props.copyMarkdown}
            className="no-underline"
          >
            <MessagesSquareIcon />
            <ContextChipLabel>{title}</ContextChipLabel>
          </ContextChip>
        }
      />
      <TooltipPopup side="top">
        {shell ? uiT("Open thread") : uiT("Thread no longer available")}
      </TooltipPopup>
    </Tooltip>
  );
}
