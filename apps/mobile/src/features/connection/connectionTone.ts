import { readUiTranslator } from "../../state/ui-language";
import type { StatusTone } from "../../components/StatusPill";
import type { RemoteClientConnectionState } from "../../lib/connection";

export function connectionTone(
  state: RemoteClientConnectionState,
  awaitingApproval?: boolean,
): StatusTone {
  const uiT = readUiTranslator();
  if (state === "reconnecting" && awaitingApproval) {
    return {
      label: uiT("Waiting for approval"),
      pillClassName: "bg-update",
      textClassName: "text-update-foreground",
    };
  }
  switch (state) {
    case "connected":
      return {
        label: uiT("Connected"),
        pillClassName: "bg-adaptive-emerald-500-a12-a16",
        textClassName: "text-adaptive-emerald-700-300",
      };
    case "reconnecting":
      return {
        label: uiT("Reconnecting"),
        pillClassName: "bg-warning",
        textClassName: "text-warning-foreground",
      };
    case "connecting":
      return {
        label: uiT("Connecting"),
        pillClassName: "bg-update",
        textClassName: "text-update-foreground",
      };
    case "unsupported":
      return {
        label: uiT("Client not supported"),
        pillClassName: "bg-subtle",
        textClassName: "text-foreground-secondary",
      };
    case "error":
      return {
        label: uiT("Connection failed"),
        pillClassName: "bg-danger",
        textClassName: "text-danger-foreground",
      };
    case "offline":
      return {
        label: uiT("Offline"),
        pillClassName: "bg-danger",
        textClassName: "text-danger-foreground",
      };
    case "available":
      return {
        label: uiT("Available"),
        pillClassName: "bg-subtle",
        textClassName: "text-foreground-secondary",
      };
  }
}
