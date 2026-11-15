import { MICROPHONE_PERMISSION_ERROR } from "@t3tools/client-runtime/voice-input";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlertIcon, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { VoiceInputPill } from "./VoiceInputPill";

import { UiText, useUiLanguage } from "../../i18n";

const VOICE_ERROR_LABELS: Record<string, string> = {
  [MICROPHONE_PERMISSION_ERROR]: "Mic blocked",
  "Microphone access is required for voice input.": "Mic blocked",
  "This draft is no longer available.": "Draft unavailable",
  "Another voice recording is already active.": "Already recording",
  "Voice transcription is not available.": "Voice input unavailable",
  "Voice transcription is still finishing. Try again shortly.": "Still transcribing",
  "Voice transcription is not available for this language.": "Language unsupported",
  "Could not prepare voice transcription.": "Couldn’t start",
  "Could not start voice recording.": "Couldn’t start",
  "Voice recording was interrupted.": "Recording interrupted",
  "Could not finish voice recording.": "Couldn’t finish",
  "Could not transcribe this recording.": "Transcription failed",
  "Voice transcription on this environment failed.": "Transcription failed",
  "The draft changed while voice input was running. The transcript was not added.": "Draft changed",
  "No speech was detected.": "No speech heard",
  "Microphone processing failed.": "Mic failed",
  "The microphone disconnected.": "Mic disconnected",
};

const RETRYABLE_TRANSCRIPTIONS = new Set([
  "Could not transcribe this recording.",
  "Voice transcription on this environment failed.",
]);

export function VoiceInputErrorPill(props: {
  error: string | null;
  errorAction: "retry" | "settings" | null;
  disabled?: boolean;
  cancelShortcutLabel?: string | null;
  size?: "default" | "compact" | undefined;
  onRetry(): void;
  onDismiss(): void;
}) {
  const { t: uiT } = useUiLanguage();
  const navigate = useNavigate();
  const message = props.error ?? uiT("Voice input failed");
  const openSettings = props.errorAction === "settings";
  const compact = props.size === "compact";
  const action = openSettings
    ? { label: uiT("Open voice settings"), text: uiT("Settings") }
    : props.error && RETRYABLE_TRANSCRIPTIONS.has(props.error)
      ? { label: uiT("Retry transcription"), text: uiT("Retry") }
      : { label: uiT("Record again"), text: uiT("Record again") };
  return (
    <VoiceInputPill tone="error" size={props.size}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size={compact ? "icon-xs" : "icon-sm-pill"}
              variant="ghost"
              aria-label={uiT("Dismiss voice input error")}
              onPointerDown={(event) => event.preventDefault()}
              onClick={props.onDismiss}
              className="shrink-0"
            >
              <XIcon />
            </Button>
          }
        />
        <TooltipPopup side="top">
          <UiText
            message={"Dismiss{0}"}
            values={{ "0": props.cancelShortcutLabel ? ` (${props.cancelShortcutLabel})` : "" }}
          />
        </TooltipPopup>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              tabIndex={0}
              role="status"
              aria-label={message}
              className="flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            />
          }
        >
          <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {(props.error && uiT(VOICE_ERROR_LABELS[props.error])) || uiT("Voice input failed")}
          </span>
        </TooltipTrigger>
        <TooltipPopup side="top">{message}</TooltipPopup>
      </Tooltip>
      {props.errorAction ? (
        <Button
          type="button"
          size={compact ? "xs" : "sm-pill"}
          variant="outline"
          aria-label={action.label}
          disabled={props.disabled}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            if (openSettings) {
              props.onDismiss();
              void navigate({ to: "/settings/voice" });
            } else {
              props.onRetry();
            }
          }}
          className="ms-auto shrink-0"
        >
          {action.text}
        </Button>
      ) : (
        <span aria-hidden className="w-1.5 shrink-0" />
      )}
    </VoiceInputPill>
  );
}
