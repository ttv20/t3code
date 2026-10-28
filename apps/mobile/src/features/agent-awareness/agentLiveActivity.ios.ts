import { readUiTranslator } from "../../state/ui-language";
import AgentActivity, { type AgentActivityProps } from "../../widgets/AgentActivity";

export function dismissEndedAgentLiveActivities() {
  AgentActivity.dismissEnded();
}

export function getAgentLiveActivities() {
  return AgentActivity.getInstances();
}

export function startAgentLiveActivity(props: AgentActivityProps, staleDate?: Date) {
  const uiT = readUiTranslator();
  return AgentActivity.start(
    {
      ...props,
      messages: Object.fromEntries(
        [
          "Approval",
          "Input",
          "Failed",
          "Done",
          "Agent work failed",
          "Agent work completed",
          "Agent status out of date",
          "{0} active {1}",
          "Out of date",
          "{0} active",
          "agent",
          "agents",
        ].map((message) => [message, uiT(message)]),
      ),
    },
    undefined,
    staleDate,
  );
}
