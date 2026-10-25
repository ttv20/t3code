import { useUiLanguage, UiText } from "../../i18n";
import {
  isModifierPairShortcut,
  type DesktopCaptureConfigApplied,
  type DesktopCaptureConfigPreview,
  type DesktopSnapShotState,
} from "@t3tools/contracts";
import { parseKeybindingShortcut } from "@t3tools/shared/keybindings";
import { FileDiff } from "@pierre/diffs/react";
import { parseDiffFromFile } from "@pierre/diffs";
import { settlePromise } from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import { useState } from "react";
import { getDesktopSnapShotBridge } from "../../lib/desktopSnapShot";
import { resolveDiffThemeName } from "../../lib/diffRendering";
import { PREFERRED_HIGHLIGHTER } from "../../lib/syntaxHighlighting";
import { useRenderedAppearance } from "../../hooks/useTheme";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { shortcutToKeybindingInput } from "./KeybindingsSettings.logic";
import { useSnapShotShortcutRecorder } from "./useSnapShotShortcutRecorder";

const DEFAULT_SHORTCUT = parseKeybindingShortcut("Ctrl+Shift+2")!;

export function CaptureShortcutConfig({
  state,
  disabled = false,
  onBusyChange,
  onSaved,
  onComplete,
}: {
  state: DesktopSnapShotState;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onSaved?: () => Promise<unknown>;
  onComplete?: () => Promise<void>;
}) {
  const { t: uiT } = useUiLanguage();
  const bridge = getDesktopSnapShotBridge();
  const resolvedTheme = useRenderedAppearance();
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const [preview, setPreview] = useState<DesktopCaptureConfigPreview | null>(null);
  const [result, setResult] = useState<DesktopCaptureConfigApplied | null>(null);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [working, setWorking] = useState<"reading" | "writing" | null>(null);
  const [keys, setKeys] = useState<string | null>(null);
  const [customFile, setCustomFile] = useState(false);
  const busy = disabled || working !== null;
  const supported = Boolean(bridge?.previewSnapShotConfig && bridge.applySnapShotConfig);
  const changed = preview !== null && preview.before !== preview.after;
  const niri = state.linuxBackend === "niri";
  const desktop = niri ? "Niri" : "Hyprland";
  const shortcutKeys = (keys ?? preview?.shortcut)?.trim();
  const recorder = useSnapShotShortcutRecorder({
    shortcut: shortcutKeys
      ? (parseKeybindingShortcut(shortcutKeys.replace(/super/gi, "meta")) ?? DEFAULT_SHORTCUT)
      : DEFAULT_SHORTCUT,
    disabled: busy,
    allowModifierPairs: false,
    onStart: () => setError(null),
    onError: (message) => setError({ message }),
    onRecord: (shortcut) => {
      if (isModifierPairShortcut(shortcut)) return;
      setKeys(
        shortcutToKeybindingInput({
          ...shortcut,
          ctrlKey: shortcut.ctrlKey || shortcut.modKey,
          modKey: false,
        }),
      );
      setPreview(null);
      setError(null);
    },
  });
  const actionBusy = busy || recorder.recording;
  const diff =
    preview && changed
      ? parseDiffFromFile(
          { name: preview.path, contents: preview.before },
          { name: preview.path, contents: preview.after },
        )
      : null;
  const begin = (phase: "reading" | "writing") => {
    setWorking(phase);
    onBusyChange?.(true);
    setError(null);
  };
  const end = () => {
    setWorking(null);
    onBusyChange?.(false);
  };
  const read = async (chooseFile = customFile, operation: "install" | "remove" = "install") => {
    if (actionBusy || !bridge?.previewSnapShotConfig) return;
    begin("reading");
    setPreview(null);
    setResult(null);
    setCustomFile(chooseFile);
    const previewed = await settlePromise(() =>
      bridge.previewSnapShotConfig!({
        operation,
        chooseFile,
        ...(keys?.trim() ? { shortcut: keys.trim() } : {}),
      }),
    );
    if (previewed._tag === "Success") {
      setPreview(previewed.value);
    } else {
      const cause = Cause.squash(previewed.cause);
      setError({
        message: uiT("Couldn't prepare the changes. Check Advanced for help."),
        ...(cause instanceof Error ? { detail: cause.message } : {}),
      });
    }
    end();
  };
  const apply = async () => {
    if (actionBusy || !preview || !bridge?.applySnapShotConfig) return;
    begin("writing");
    const saved = await settlePromise(async () => {
      const applied = await bridge.applySnapShotConfig!(preview.id);
      setResult(applied);
      await onSaved?.();
      if (!applied.warning && preview.operation === "install" && onComplete) {
        toastManager.add({
          type: "success",
          title: uiT("Shortcut saved"),
          description: uiT("Use {0} from another app.", { "0": preview.shortcut }),
        });
        await onComplete();
      }
    });
    if (saved._tag === "Failure") {
      const cause = Cause.squash(saved.cause);
      setError({
        message: uiT("Couldn't save your shortcut. Review the changes and try again."),
        ...(cause instanceof Error ? { detail: cause.message } : {}),
      });
      setPreview(null);
    }
    end();
  };

  return (
    <div className="space-y-4 text-sm">
      {!result ? (
        <div className="flex items-center justify-between gap-3">
          <span>{uiT("Shortcut")}</span>
          {recorder.input}
        </div>
      ) : null}
      {recorder.recording ? (
        <p role="status" className="text-xs text-muted-foreground">
          {uiT("Press your shortcut. Esc cancels.")}
        </p>
      ) : null}
      {result ? (
        <p role="status">
          {result.warning
            ? uiT("Saved, but the shortcut needs attention. Check Advanced for help.")
            : preview?.operation === "remove"
              ? uiT("Shortcut removed.")
              : uiT("Use {0} from another app to capture a window.", { "0": preview?.shortcut })}
        </p>
      ) : preview ? (
        <>
          <p className="text-muted-foreground">
            {changed
              ? preview.operation === "remove"
                ? uiT("Review the change below to remove your shortcut.")
                : uiT("Review the change below, then save your shortcut.")
              : preview.operation === "remove"
                ? uiT("There's no capture shortcut to remove.")
                : uiT("This shortcut is already set up.")}
          </p>
          {diff ? (
            <div
              dir="ltr"
              className="max-h-80 overflow-auto rounded-lg border text-xs"
              aria-label={uiT("Shortcut changes")}
            >
              <FileDiff
                fileDiff={diff}
                options={{
                  diffStyle: "unified",
                  theme: resolveDiffThemeName(resolvedTheme),
                  overflow: "wrap",
                  preferredHighlighter: PREFERRED_HIGHLIGHTER,
                }}
              />
            </div>
          ) : null}
          {changed ? (
            <p className="text-xs text-muted-foreground">
              {uiT("Only these changes will be saved. We'll keep a backup.")}
            </p>
          ) : null}
          <div className="flex gap-2">
            {changed || preview.operation === "install" ? (
              <Button
                disabled={
                  actionBusy ||
                  (preview.operation === "install" && state.shortcutActionRegistered === false)
                }
                aria-busy={working === "writing"}
                onClick={() => void apply()}
              >
                {working === "writing"
                  ? uiT("Saving…")
                  : changed
                    ? preview.operation === "install"
                      ? uiT("Save shortcut")
                      : uiT("Remove shortcut")
                    : uiT("Done")}
              </Button>
            ) : null}
            <Button variant="ghost" disabled={actionBusy} onClick={() => setPreview(null)}>
              {uiT("Cancel")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            {uiT(
              "Allow T3 Code to read your desktop settings. You'll review any changes here before saving.",
            )}
          </p>
          <Button
            disabled={actionBusy || !supported}
            aria-busy={working === "reading"}
            onClick={() => void read()}
          >
            {working === "reading" ? uiT("Preparing changes…") : uiT("Review changes")}
          </Button>
          {!supported ? (
            <p className="text-xs text-muted-foreground">
              {uiT("Update T3 Code to finish setting up your shortcut.")}
            </p>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      ) : null}
      {state.shortcutActionRegistered === false && state.shortcutMessage ? (
        <p role="status" className="text-muted-foreground">
          {state.shortcutPending
            ? uiT("Connecting to your desktop…")
            : uiT("Restart T3 Code to finish connecting your shortcut.")}
        </p>
      ) : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{uiT("Advanced")}</summary>
        <div className="mt-3 space-y-3">
          {error?.detail || result?.warning ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{uiT("Troubleshooting")}</p>
              <p className="break-words">{error?.detail ?? result?.warning}</p>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="font-medium text-foreground">{uiT("Settings file")}</p>
            <p className="break-all font-mono">
              {preview?.path ??
                state.shortcutConfigPath ??
                (niri ? uiT("~/.config/niri/config.kdl") : uiT("~/.config/hypr/hyprland.conf"))}
            </p>
            {niri ? <p>{uiT("T3 Code also reads any files included by this file.")}</p> : null}
            {preview && preview.resolvedPath !== preview.path ? (
              <p className="break-all">
                {uiT("Linked to")} {preview.resolvedPath}
                {uiT(". The link will be kept.")}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={actionBusy || !supported}
              onClick={() => void read(true)}
            >
              {uiT("Choose a different file…")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionBusy || !supported}
              onClick={() => void read(customFile, "remove")}
            >
              {uiT("Remove shortcut…")}
            </Button>
            {result ? (
              <Button
                size="sm"
                variant="outline"
                disabled={actionBusy || !supported}
                onClick={() => void read()}
              >
                {uiT("Review changes")}
              </Button>
            ) : null}
          </div>
          <p>
            <UiText
              message={"Use your desktop's shortcut settings file. {0}"}
              values={{
                "0": niri
                  ? uiT("A custom --config or NIRI_CONFIG can change its location.")
                  : uiT("On Omarchy, use your own bindings file, not its defaults."),
              }}
            />
          </p>
          {result?.backupPath ? (
            <p className="break-all">
              {uiT("Backup:")} {result.backupPath}
            </p>
          ) : null}
          <p className="font-medium text-foreground">{uiT("Manual setup")}</p>
          <p>
            <UiText
              message={"{0} Change the keys if needed."}
              values={{
                "0": niri
                  ? uiT("Paste this inside binds { … } in your Niri config, then save.")
                  : uiT("Add this binding to your Hyprland config, then save."),
              }}
            />
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-muted/50 p-3">
            {state.shortcutBinding}
          </pre>
          <Button
            size="sm"
            variant="outline"
            disabled={actionBusy || !state.shortcutBinding}
            onClick={() => {
              if (state.shortcutBinding) copyToClipboard(state.shortcutBinding);
            }}
          >
            {isCopied ? uiT("Copied") : uiT("Copy shortcut")}
          </Button>
          <p>
            <UiText
              message={
                "Turn capture off in T3 Code to stop it. Remove the shortcut from {0} to free up the keys."
              }
              values={{ "0": desktop }}
            />
          </p>
          {state.shortcutActionRegistered === false ? (
            <p role="status">{state.shortcutMessage}</p>
          ) : null}
          {onComplete ? (
            <Button
              size="sm"
              variant="outline"
              disabled={actionBusy || state.shortcutActionRegistered === false}
              onClick={() => void onComplete()}
            >
              {uiT("I've added the shortcut")}
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}
