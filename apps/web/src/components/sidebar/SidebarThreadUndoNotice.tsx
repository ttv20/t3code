import { useUiLanguage } from "../../i18n";
import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { undoLatestThreadAction, useThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { shortcutLabelForCommand } from "../../keybindings";
import { announce, cancelAnnouncement } from "../../lib/announce";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { Alert, AlertDescription } from "../ui/alert";
import { InlineButton } from "../ui/button";

const UNDO_MESSAGES = {
  Settled: ["Settled {0} thread", "Settled {0} threads"],
  Snoozed: ["Snoozed {0} thread", "Snoozed {0} threads"],
  Unpinned: ["Unpinned {0} thread", "Unpinned {0} threads"],
  Archived: ["Archived {0} thread", "Archived {0} threads"],
  Discarded: ["Discarded {0} draft", "Discarded {0} drafts"],
} as const;

export function SidebarThreadUndoNotice() {
  const { t: uiT } = useUiLanguage();
  const notice = useThreadUndoNotice((state) => state.notice);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);

  const shortcut = shortcutLabelForCommand(keybindings, "thread.undo");
  const undoLabel = shortcut ? uiT("{0} to undo", { "0": shortcut }) : uiT("Undo");
  const summary = notice
    ? uiT(UNDO_MESSAGES[notice.action][notice.count === 1 ? 0 : 1], { "0": notice.count })
    : null;

  // A live region that mounts already filled is skipped by screen readers, and settling
  // usually moves focus to the next thread at the same moment.
  useEffect(() => {
    if (summary) announce(`${summary}, ${undoLabel}`, "thread-undo-notice");
    else cancelAnnouncement("thread-undo-notice");
  }, [summary, undoLabel]);

  if (!summary) return null;

  return (
    <Alert role="group" variant="sidebar">
      <AlertDescription>
        {summary}, <InlineButton onClick={undoLatestThreadAction}>{undoLabel}</InlineButton>
      </AlertDescription>
    </Alert>
  );
}
