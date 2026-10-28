import { useUiLanguage } from "../i18n";
import { type EnvironmentContextRecord, resolveEnvironmentMachineKind } from "@t3tools/contracts";

import { useEnvironment } from "~/state/environments";
import { ContextChip, ContextChipLabel } from "./ContextChip";
import { EnvironmentMachineIcon } from "./EnvironmentMachineIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

/**
 * Inline chip for a mentioned machine, in the composer and in sent messages. Prefers the
 * name this client knows the machine by, and draws it with its machine icon.
 */
export function EnvironmentContextChip(props: {
  record: Pick<EnvironmentContextRecord, "environmentId" | "label">;
  copyMarkdown?: string;
}) {
  const { t: uiT } = useUiLanguage();

  const environment = useEnvironment(props.record.environmentId);
  const label = environment?.label.trim() || props.record.label;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ContextChip
            kind="environment"
            tabIndex={0}
            aria-label={uiT("Machine, {0}", { "0": label })}
            data-markdown-copy={props.copyMarkdown}
          >
            <EnvironmentMachineIcon
              kind={resolveEnvironmentMachineKind(environment?.serverConfig ?? null)}
            />
            <ContextChipLabel>{label}</ContextChipLabel>
          </ContextChip>
        }
      />
      <TooltipPopup side="top">
        {environment ? "T3 Code environment" : "Machine not in this app"}
      </TooltipPopup>
    </Tooltip>
  );
}
