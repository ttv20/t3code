import { useUiLanguage, UiText } from "../../i18n";
import { useState } from "react";
import * as Option from "effect/Option";
import type { SshDeviceHostConfig } from "@t3tools/contracts";
import { CheckIcon, MonitorIcon, XIcon } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Spinner } from "../ui/spinner";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "../ui/dialog";
import { DeviceHostAvailability } from "../device/DeviceHostAvailability";
import { useHostConnectionChecks } from "./useHostConnectionChecks";
import {
  deviceHostConnectionKey,
  parseDeviceHostDraft,
  type DeviceHostCheckTarget,
} from "./deviceHostConnectionChecks";

export function DeviceHostEditor({
  host,
  isNew,
  targets,
  busy,
  onSave,
  onClose,
}: {
  host: SshDeviceHostConfig;
  isNew: boolean;
  targets: ReadonlyArray<DeviceHostCheckTarget>;
  busy: boolean;
  onSave: (host: SshDeviceHostConfig) => void;
  onClose: () => void;
}) {
  const { t: uiT } = useUiLanguage();
  const [draft, setDraft] = useState(host);
  const { checks, testConnection } = useHostConnectionChecks(targets);
  const results = checks[deviceHostConnectionKey(draft)];
  const checking = Object.values(results ?? {}).some((check) => check.status === "pending");
  const input = parseDeviceHostDraft({ ...draft, label: draft.label.trim() || draft.target });
  const valid = Option.isSome(input);
  const failed = Object.values(results ?? {}).filter((check) => check.status === "failed").length;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup
        showCloseButton={!busy}
        render={
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (Option.isSome(input) && draft.label.trim() && !busy && !checking)
                onSave(input.value);
            }}
          />
        }
      >
        <DialogHeader>
          <DialogTitle>{isNew ? uiT("Add device host") : uiT("Edit device host")}</DialogTitle>
          <DialogDescription>
            <UiText
              message={"{0} Hosts on the same machine are skipped."}
              values={{
                "0":
                  targets.length === 1
                    ? uiT("Connect from {0}.", { "0": targets[0]?.label })
                    : uiT("Connect from {0} selected environments.", { "0": targets.length }),
              }}
            />
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <label className="block space-y-1.5 text-sm">
            <span>{uiT("Name")}</span>
            <Input
              autoFocus
              required
              value={draft.label}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              placeholder={uiT("Mac mini")}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span>{uiT("SSH target")}</span>
            <Input
              required
              value={draft.target}
              disabled={busy}
              onChange={(event) => setDraft({ ...draft, target: event.target.value })}
              placeholder={uiT("user@host or SSH alias")}
            />
          </label>
          <details
            open={host.port !== undefined || host.identityFile !== undefined || undefined}
            className="text-sm"
          >
            <summary className="cursor-pointer text-muted-foreground">{uiT("SSH options")}</summary>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <label className="block space-y-1.5">
                <span>{uiT("Identity file")}</span>
                <Input
                  value={draft.identityFile ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const { identityFile: _, ...rest } = draft;
                    setDraft(
                      event.target.value ? { ...rest, identityFile: event.target.value } : rest,
                    );
                  }}
                  placeholder={uiT("SSH config default")}
                />
              </label>
              <label className="block space-y-1.5">
                <span>{uiT("Port")}</span>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={draft.port ?? ""}
                  disabled={busy}
                  onChange={(event) => {
                    const { port: _, ...rest } = draft;
                    setDraft(
                      event.target.value ? { ...rest, port: Number(event.target.value) } : rest,
                    );
                  }}
                  placeholder={uiT("Default")}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {uiT("Optional. Resolved separately on each environment.")}
            </p>
          </details>
          <div className="rounded-lg border border-border/60">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <p role="status" className="text-xs text-muted-foreground">
                {checking
                  ? uiT("Checking environments…")
                  : results
                    ? failed
                      ? uiT("{0} of {1} failed", { "0": failed, "1": targets.length })
                      : uiT("Connection checks passed")
                    : uiT("Check access before saving")}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || checking || !valid}
                onClick={() => {
                  if (Option.isSome(input)) void testConnection(input.value);
                }}
              >
                <UiText
                  message={"{0} Test connection"}
                  values={{ "0": checking ? <Spinner size="xs" /> : null }}
                />
              </Button>
            </div>
            {results ? (
              <ul className="border-t border-border/60 divide-y divide-border/40">
                {targets.map((target) => {
                  const result = results[target.environmentId];
                  if (!result) return null;
                  return (
                    <li key={target.environmentId} className="px-3 py-2.5 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium">{uiT(target.label)}</span>
                        <span
                          className={`flex shrink-0 items-center gap-1.5 ${result.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {result.status === "pending" ? (
                            <>
                              <Spinner size="xs" /> {uiT("Checking…")}
                            </>
                          ) : result.status === "local" ? (
                            <>
                              <MonitorIcon className="size-3" /> {uiT("Already available locally")}
                            </>
                          ) : result.status === "failed" ? (
                            <>
                              <XIcon className="size-3" /> {uiT("Failed")}
                            </>
                          ) : (
                            <>
                              <CheckIcon className="size-3" /> {uiT("Connected")}
                            </>
                          )}
                        </span>
                      </div>
                      {result.status === "connected" ? (
                        <div className="mt-1.5">
                          <DeviceHostAvailability platforms={result.platforms} />
                        </div>
                      ) : null}
                      {result.status === "failed" ? (
                        <details className="mt-1.5 text-muted-foreground">
                          <summary className="cursor-pointer">{uiT("Show error")}</summary>
                          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                            {result.error}
                          </p>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
            {uiT("Cancel")}
          </Button>
          <Button type="submit" disabled={busy || checking || !valid || !draft.label.trim()}>
            <UiText
              message={"{0} Save host"}
              values={{ "0": busy ? <Spinner size="xs" /> : null }}
            />
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
