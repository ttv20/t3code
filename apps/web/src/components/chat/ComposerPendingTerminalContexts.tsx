import { useUiLanguage } from "../../i18n";
import {
  type TerminalContextDraft,
  formatTerminalContextLabel,
  isTerminalContextExpired,
} from "~/lib/terminalContext";
import type { ContextPresentationCapability } from "../contextPresentationRegistry";
import { TerminalContextInlineChip } from "./TerminalContextInlineChip";

interface ComposerPendingTerminalContextChipProps {
  context: TerminalContextDraft;
  detailsMode: ContextPresentationCapability["details"];
}

export function ComposerPendingTerminalContextChip({
  context,
  detailsMode,
}: ComposerPendingTerminalContextChipProps) {
  const { t: uiT } = useUiLanguage();
  const label = formatTerminalContextLabel(context);
  const expired = isTerminalContextExpired(context);

  return (
    <TerminalContextInlineChip
      label={uiT(label)}
      terminalLabel={context.terminalLabel}
      lineStart={context.lineStart}
      lineEnd={context.lineEnd}
      text={context.text}
      expired={expired}
      detailsMode={detailsMode}
    />
  );
}
