import { useUiLanguage } from "../../i18n";
import { useAtomValue } from "@effect/atom-react";

import { undoLatestThreadAction, useThreadUndoNotice } from "../../hooks/showThreadUndoNotice";
import { shortcutLabelForCommand } from "../../keybindings";
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

  if (!notice) return null;
  const shortcut = shortcutLabelForCommand(keybindings, "thread.undo");
  const message = UNDO_MESSAGES[notice.action][notice.count === 1 ? 0 : 1];

  return (
    <Alert role="status" variant="sidebar">
      <AlertDescription>
        {uiT(message, { "0": notice.count })},{" "}
        <InlineButton onClick={undoLatestThreadAction}>
          {shortcut ? uiT("{0} to undo", { "0": shortcut }) : uiT("Undo")}
        </InlineButton>
      </AlertDescription>
    </Alert>
  );
}
