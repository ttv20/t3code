import { useStableCallback } from "~/hooks/useStableCallback";
import {
  listBrowserMicrophones,
  updateMicrophoneOrder,
  type BrowserMicrophone,
} from "../../speech/browserMicrophones";
import type {
  EnvironmentId,
  EnvironmentSpeechModel,
  EnvironmentSpeechStatus,
} from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { CircleAlertIcon, MicIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useClientSettings } from "../../hooks/useSettings";
import {
  isSystemDefaultDeviceId,
  microphoneOrder,
  preferMicrophone,
  preferredMicrophoneId,
} from "../../speech/microphoneOrder";
import { useEnvironment } from "../../state/environments";
import { AuthSettingsWriteScope } from "@t3tools/contracts";
import { useEnvironmentScope } from "../../state/session";
import { languageLabel } from "../settings/SpeechLanguageSelect";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { WizardFooter, WizardHeader, WizardPanel, WizardPopup } from "../ui/wizard";

import { UiText, useUiLanguage } from "../../i18n";

export function VoiceInputSetup(props: {
  environmentId: EnvironmentId | null;
  open: boolean;
  step: number;
  status: EnvironmentSpeechStatus | null;
  model: EnvironmentSpeechModel | null;
  /** The language the offered model was chosen for. */
  language: string | null;
  downloading: boolean;
  error: string | null;
  onOpenChange(open: boolean): void;
  onRetryCatalog: (() => void) | null;
  onDownload(): void;
  onCancelDownload(): void;
  onStartRecording(): void;
}) {
  const { t: uiT } = useUiLanguage();
  const navigate = useNavigate();
  const environment = useEnvironment(props.environmentId);
  const canManage = useEnvironmentScope(props.environmentId, AuthSettingsWriteScope);
  const order = useClientSettings(microphoneOrder);
  const [microphones, setMicrophones] = useState<BrowserMicrophone[]>([]);
  const selectedMicrophone = preferredMicrophoneId(order, microphones);
  const [loadingMicrophones, setLoadingMicrophones] = useState(false);
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const refreshMicrophones = useStableCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    setLoadingMicrophones(true);
    try {
      setMicrophones(await listBrowserMicrophones());
      setMicrophoneError(null);
    } catch {
      setMicrophoneError(uiT("Couldn’t list microphones. The system default still works."));
    }
    setLoadingMicrophones(false);
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- subscribes to native microphone changes while the device setup step is visible
  useEffect(() => {
    if (!props.open || props.step !== 1) return;
    queueMicrotask(() => void refreshMicrophones());
    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener?.("devicechange", refreshMicrophones);
    return () => mediaDevices?.removeEventListener?.("devicechange", refreshMicrophones);
  }, [props.open, props.step, refreshMicrophones]);
  const selectedIsUnavailable = Boolean(
    selectedMicrophone && !microphones.some((device) => device.deviceId === selectedMicrophone),
  );
  const selectedMicrophoneLabel = selectedMicrophone
    ? (microphones.find((device) => device.deviceId === selectedMicrophone)?.label ??
      uiT("Selected microphone (Unavailable)"))
    : uiT("System default");
  const status = props.status?.supported ? props.status : null;
  const model = props.model;
  const progress =
    model?.downloaded === undefined ? null : Math.round((model.downloaded / model.size) * 100);
  const openSettings = (hash: string) => {
    props.onOpenChange(false);
    void navigate({ to: "/settings/voice", hash });
  };

  const destination = environment?.label ?? "your transcription environment";

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <WizardPopup>
        <WizardHeader
          title={props.step === 0 ? uiT("Set up voice input") : uiT("Voice input is ready")}
          description={
            props.step === 0
              ? uiT("Download a speech model once. Your audio is transcribed on {0}.", {
                  "0": destination,
                })
              : uiT("Pick a microphone, then start talking.")
          }
        />
        <WizardPanel>
          {props.step === 0 ? (
            <section className="space-y-3 text-sm">
              {model ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="min-w-0 truncate font-medium">{model.name}</h3>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      <UiText
                        message={"{0} MB"}
                        values={{ "0": Math.round(model.size / 1024 / 1024) }}
                      />
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <UiText
                      message={
                        model.recommended && props.language
                          ? "Recommended for {0}. Includes a 1.2 MB silence detector."
                          : "Includes a 1.2 MB silence detector."
                      }
                      values={{ "0": props.language ? languageLabel(props.language) : "" }}
                    />
                  </p>
                  {props.downloading ? (
                    <div role="status" className="space-y-1.5">
                      <div
                        role="progressbar"
                        aria-label={uiT("Speech model download progress")}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress ?? undefined}
                        className="h-1 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full bg-primary transition-[width] duration-200"
                          style={{ width: `${progress ?? 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {model.state === "verifying"
                          ? uiT("Verifying…")
                          : progress === null
                            ? uiT("Starting download…")
                            : uiT("{0}% downloaded", { "0": progress })}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : !props.error ? (
                <p role="status" className="text-muted-foreground">
                  <UiText message={"Loading transcription models…"} />
                </p>
              ) : null}
              {props.error ? (
                <p role="alert" className="flex items-start gap-1.5 text-destructive">
                  <CircleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {props.error}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="space-y-2 text-sm">
              <label className="sr-only" htmlFor="voice-setup-microphone">
                <UiText message={"Microphone"} />
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedMicrophone ? `device:${selectedMicrophone}` : "system-default"}
                  disabled={loadingMicrophones}
                  onValueChange={(value) => {
                    if (!value) return;
                    const deviceId = value.slice("device:".length);
                    const label =
                      microphones.find((device) => device.deviceId === deviceId)?.label ?? "";
                    updateMicrophoneOrder((order) =>
                      preferMicrophone(
                        order,
                        value === "system-default" || isSystemDefaultDeviceId(deviceId)
                          ? { kind: "default" }
                          : { kind: "device", deviceId, label },
                      ),
                    );
                  }}
                >
                  <SelectTrigger
                    id="voice-setup-microphone"
                    size="sm"
                    aria-label={uiT("Microphone")}
                    className="min-w-0 flex-1"
                  >
                    <MicIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue>{selectedMicrophoneLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    <SelectItem value="system-default">
                      <UiText message={"System default"} />
                    </SelectItem>
                    {selectedIsUnavailable ? (
                      <SelectItem value={`device:${selectedMicrophone}`}>
                        <UiText message={"Selected microphone (Unavailable)"} />
                      </SelectItem>
                    ) : null}
                    {microphones.map((device) => (
                      <SelectItem key={device.deviceId} value={`device:${device.deviceId}`}>
                        {device.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={loadingMicrophones}
                  aria-label={uiT("Refresh microphones")}
                  onClick={() => void refreshMicrophones()}
                >
                  <RefreshCwIcon className="size-3.5" />
                </Button>
              </div>
              {selectedIsUnavailable ? (
                <p className="text-xs text-destructive">
                  <UiText message={"That microphone is unplugged. Pick another one."} />
                </p>
              ) : null}
              {microphoneError ? (
                <p role="alert" className="text-xs text-muted-foreground">
                  {microphoneError}
                </p>
              ) : null}
            </section>
          )}
        </WizardPanel>
        {props.step === 0 ? (
          <WizardFooter
            leading={
              <Button variant="ghost" onClick={() => openSettings("speech-models")}>
                {model ? uiT("Other models") : uiT("Choose a model")}
              </Button>
            }
          >
            {props.onRetryCatalog ? (
              <Button onClick={props.onRetryCatalog}>
                <UiText message={"Retry loading models"} />
              </Button>
            ) : null}
            {props.downloading ? (
              <Button variant="outline" disabled={!canManage} onClick={props.onCancelDownload}>
                <UiText message={"Cancel download"} />
              </Button>
            ) : null}
            {model ? (
              <Button
                disabled={!canManage || props.downloading || !status}
                onClick={props.onDownload}
              >
                {props.downloading
                  ? uiT("Downloading…")
                  : props.error
                    ? uiT("Try again")
                    : canManage
                      ? uiT("Download model")
                      : uiT("Needs an admin to download")}
              </Button>
            ) : null}
          </WizardFooter>
        ) : (
          <WizardFooter
            leading={
              <Button variant="ghost" onClick={() => openSettings("")}>
                <UiText message={"Voice settings"} />
              </Button>
            }
          >
            <Button onClick={props.onStartRecording}>
              <MicIcon />
              <UiText message={"Start dictating"} />
            </Button>
          </WizardFooter>
        )}
      </WizardPopup>
    </Dialog>
  );
}
