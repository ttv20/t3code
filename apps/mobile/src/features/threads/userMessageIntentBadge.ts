import { readUiTranslator } from "../../state/ui-language";
import type { OrchestrationV2UserMessageInputIntent } from "@t3tools/contracts";

export interface UserMessageIntentBadgePresentation {
  readonly label: string;
  readonly accessibilityLabel: string;
}

export function resolveUserMessageIntentBadge(
  intent: OrchestrationV2UserMessageInputIntent | undefined,
  unread = false,
): UserMessageIntentBadgePresentation | null {
  const uiT = readUiTranslator();
  if (unread && (intent === "steer" || intent === "promoted_queued_to_steer")) {
    return {
      label: uiT("Steer · waiting to be read"),
      accessibilityLabel: uiT(
        "Steer waiting for the agent to read it after the running command finishes",
      ),
    };
  }
  switch (intent) {
    case "steer":
      return {
        label: uiT("Steer"),
        accessibilityLabel: uiT("Steered the active turn"),
      };
    case "promoted_queued_to_steer":
      return {
        label: uiT("Steer"),
        accessibilityLabel: uiT("Originally queued, then promoted to steer the active turn"),
      };
    case "queued_turn":
    case "turn_start":
    case undefined:
      return null;
  }
}
