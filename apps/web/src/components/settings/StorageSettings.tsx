import { useUiLanguage } from "../../i18n";
import type {
  StorageCleanupReport,
  StorageCleanupSettings,
  WorktreeCleanupRules,
} from "@t3tools/contracts";
import { resolveWorktreeCleanup } from "@t3tools/shared/projectSettings";
import { useMemo, useRef, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { Atom } from "effect/reactivity";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { formatBytes } from "../../lib/formatBytes";
import { serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { formatRelativeTimeLabel } from "../../timestampFormat";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";

import { Input } from "../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  useRelativeTimeTick,
} from "./settingsLayout";
import { SettingsScopeNotice } from "./SettingsScopeNotice";
import { FoldedSettingsSection } from "./FoldedSettingsSection";
import { SettingsGroup } from "./SettingsGroup";
import type { ScopedSettingsTarget } from "./scopedSettings";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  useClearScopedSettings,
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

function WorktreesDirectoryRow() {
  const { t: uiT } = useUiLanguage();
  const { connectedEnvironments, targets } = useSettingsScope();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["worktreesDirectory"]);
  const edited = useRef(false);
  if (
    connectedEnvironments.some(
      (environment) =>
        environment.serverConfig?.environment.capabilities.worktreesDirectory !== true,
    )
  )
    return null;
  const scopeKey = targets.map((target) => target.environmentId).join(",");

  return (
    <SettingsRow
      {...searchableSetting("storage-worktrees-location")}
      description={uiT(
        "Folder where new worktrees are created, on any drive, such as D:\\worktrees or ~/worktrees. Existing worktrees stay where they are. Leave empty to use the T3 home folder.",
      )}
      serverScoped
      settingKeys={["worktreesDirectory"]}
      resetAction={
        mixed || settings.worktreesDirectory !== "" ? (
          <SettingResetButton
            label={uiT("worktree location")}
            onClick={() => updateSettings({ worktreesDirectory: "" })}
          />
        ) : null
      }
      control={
        <Input
          key={`${scopeKey}:${mixed}:${settings.worktreesDirectory}`}
          aria-label={uiT("Worktree location")}
          autoCapitalize="none"
          spellCheck={false}
          placeholder={mixed ? uiT("Mixed") : uiT("Default")}
          defaultValue={mixed ? "" : settings.worktreesDirectory}
          onChange={() => {
            edited.current = true;
          }}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (edited.current && (mixed || value !== settings.worktreesDirectory))
              updateSettings({ worktreesDirectory: value });
            edited.current = false;
          }}
        />
      }
    />
  );
}

function RetentionControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { t: uiT } = useUiLanguage();
  const [draft, setDraft] = useState(value);
  const [savedValue, setSavedValue] = useState(value);
  if (savedValue !== value) {
    setSavedValue(value);
    setDraft(value);
  }

  return (
    <div className="flex items-center gap-3">
      {value !== null ? (
        <NumberField
          value={draft}
          min={1}
          max={3650}
          step={1}
          size="sm"
          className="w-auto"
          onValueChange={setDraft}
          onValueCommitted={(next) => {
            if (next === null) setDraft(value);
            else {
              const days = Math.min(3650, Math.max(1, Math.round(next)));
              setDraft(days);
              onChange(days);
            }
          }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement aria-label={uiT("Decrease {0}", { "0": label })} />
            <NumberFieldInput
              aria-label={uiT("{0} in days", { "0": label })}
              size={new Intl.NumberFormat().format(draft ?? value).length}
              className="field-sizing-content w-auto min-w-[1ch] grow-0 text-right"
            />
            <span aria-hidden="true" className="self-center pr-2 text-xs">
              {uiT("days")}
            </span>
            <NumberFieldIncrement aria-label={uiT("Increase {0}", { "0": label })} />
          </NumberFieldGroup>
        </NumberField>
      ) : (
        <span className="text-xs text-muted-foreground">{uiT("Off")}</span>
      )}
      <Switch
        aria-label={uiT(label)}
        checked={value !== null}
        onCheckedChange={(enabled) => onChange(enabled ? 8 : null)}
      />
    </div>
  );
}

const KEEP_WHEN_LABELS = {
  "any-local-files": "Any local files",
  "uncommitted-changes": "Uncommitted changes",
  "tracked-changes": "Edited tracked files",
} as const;

function CleanupResults({
  report,
  environmentLabel,
}: {
  report: StorageCleanupReport;
  environmentLabel: string | undefined;
}) {
  const { t: uiT } = useUiLanguage();
  return (
    <>
      {report.entries.map((entry, index) => {
        const name =
          entry.kind === "worktree"
            ? (entry.path?.split(/[\\/]/).findLast(Boolean) ?? uiT("Worktrees"))
            : entry.kind === "logs"
              ? uiT("Rotated logs")
              : uiT("Browser artifacts");
        return (
          <SettingsRow
            key={`${entry.path ?? entry.kind}:${entry.threadId ?? index}`}
            title={environmentLabel ? `${environmentLabel}: ${name}` : name}
            description={
              <span
                className={`wrap-anywhere ${entry.outcome === "failed" ? "text-destructive" : ""}`}
              >
                {entry.threadTitle && entry.threadTitle !== name ? `${entry.threadTitle}. ` : ""}
                {uiT(entry.reason)}
              </span>
            }
            control={
              entry.outcome === "removed" && (
                <span className="text-xs text-muted-foreground">
                  {[
                    entry.kind !== "worktree" && entry.files !== null
                      ? uiT(entry.files === 1 ? "{0} file" : "{0} files", {
                          "0": entry.files.toLocaleString(),
                        })
                      : null,
                    entry.bytes !== null ? formatBytes(entry.bytes) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )
            }
          />
        );
      })}
      {report.omittedCount > 0 && (
        <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          {environmentLabel ? `${environmentLabel}: ` : ""}
          {report.omittedCount.toLocaleString()} {uiT("more results.")}
        </p>
      )}
      {report.entries.length === 0 && report.omittedCount === 0 && (
        <p className="px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          {environmentLabel ? `${environmentLabel}: ` : ""}
          {uiT("Nothing needed cleanup.")}
        </p>
      )}
    </>
  );
}

function CleanupSection() {
  const { t: uiT } = useUiLanguage();
  useRelativeTimeTick(60_000);
  const { connectedEnvironments } = useSettingsScope();
  const [pending, setPending] = useState(false);
  const run = useAtomCommand(serverEnvironment.runStorageCleanup);
  const supported = connectedEnvironments.filter(
    (environment) => environment.serverConfig?.environment.capabilities.storageCleanupRun === true,
  );
  const state = useAtomValue(
    useMemo(
      () =>
        Atom.make((get) =>
          connectedEnvironments.flatMap((environment) => {
            if (environment.serverConfig?.environment.capabilities.storageCleanupRun !== true)
              return [];
            const query = get(
              serverEnvironment.storageCleanupReport({
                environmentId: environment.environmentId,
                input: {},
              }),
            );
            return [
              {
                environmentId: environment.environmentId,
                allowed: get(
                  serverEnvironment.runStorageCleanup.permissionAtom(environment.environmentId),
                ),
                report: query._tag === "Success" ? query.value : null,
                loading: query.waiting,
                failed: query._tag === "Failure",
              },
            ];
          }),
        ),
      [connectedEnvironments],
    ),
  );
  const hasRules = supported.some((environment) => {
    const settings = environment.serverConfig?.settings;
    if (!settings) return false;
    const enabled = (rules: WorktreeCleanupRules) =>
      rules.worktreeAfterDays !== null ||
      rules.worktreeOnMerge ||
      rules.worktreeOnDelete ||
      rules.worktreeUnchanged;
    return (
      settings.storageCleanup.browserArtifactsAfterDays !== null ||
      settings.storageCleanup.logsAfterDays !== null ||
      enabled(resolveWorktreeCleanup(settings, null)) ||
      Object.values(settings.projectSettingsOverrides).some(
        (override) =>
          override.worktreeCleanup?.mode === "custom" && enabled(override.worktreeCleanup.rules),
      )
    );
  });
  if (supported.length === 0) return null;
  const summaries = supported.map((environment) => {
    const query = state.find((entry) => entry.environmentId === environment.environmentId);
    const report = query?.report ?? null;
    return {
      environment,
      report,
      description: report
        ? uiT("Last run {0}. {1} recovered.{2}", {
            "0": formatRelativeTimeLabel(report.finishedAt),
            "1": formatBytes(report.bytesFreed),
            "2":
              report.counts.failed > 0
                ? " " +
                  uiT(
                    report.counts.failed === 1
                      ? "Could not remove {0} item."
                      : "Could not remove {0} items.",
                    { "0": report.counts.failed },
                  )
                : "",
          })
        : query?.failed
          ? uiT("Could not load the last run.")
          : query?.loading
            ? uiT("Loading last run…")
            : uiT("Cleanup hasn't run yet."),
    };
  });
  const deleteNow = async () => {
    if (pending) return;
    setPending(true);
    try {
      await Promise.all(
        supported
          .filter((environment) =>
            state.some(
              (entry) => entry.environmentId === environment.environmentId && entry.allowed,
            ),
          )
          .map(async (environment) => {
            const result = await run({ environmentId: environment.environmentId, input: {} });
            if (result._tag === "Success") {
              const failures = result.value.entries.filter((entry) => entry.outcome === "failed");
              if (failures.length > 0)
                toastManager.add({
                  type: "error",
                  title: uiT("Cleanup failed on {0}", { "0": environment.label }),
                  description: failures[0]!.reason,
                });
            } else if (!isAtomCommandInterrupted(result)) {
              toastManager.add({
                type: "error",
                title: uiT("Could not run cleanup on {0}", { "0": environment.label }),
                description: String(squashAtomCommandFailure(result)),
              });
            }
          }),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <SettingsSection id="storage-cleanup" title={uiT("Cleanup")} variant="plain">
      <SettingsGroup>
        <SettingsRow
          {...searchableSetting("storage-delete-now")}
          description={
            <span>
              {!hasRules
                ? uiT("Turn on a cleanup rule to use this.")
                : summaries.map(({ environment, description }) => (
                    <span key={environment.environmentId} className="block">
                      {supported.length > 1 ? `${environment.label}: ` : ""}
                      {uiT(description)}
                    </span>
                  ))}
            </span>
          }
          control={
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !hasRules || !state.some((entry) => entry.allowed)}
              onClick={() => void deleteNow()}
            >
              {pending ? uiT("Deleting…") : uiT("Delete now")}
            </Button>
          }
        />
      </SettingsGroup>
      {summaries.some(({ report }) => report !== null) && (
        <FoldedSettingsSection
          id="storage-cleanup-last-run"
          title={uiT("Last run")}
          headerPlacement="inside"
          summary={summaries
            .flatMap(({ environment, report }) =>
              report
                ? [
                    `${connectedEnvironments.length > 1 ? `${environment.label}: ` : ""}${uiT("{0} removed, {1} kept{2}", { "0": report.counts.removed, "1": report.counts.kept, "2": report.counts.failed > 0 ? uiT(", {0} failed", { "0": report.counts.failed }) : "" })}`,
                  ]
                : [],
            )
            .join(" · ")}
        >
          {summaries.map(
            ({ environment, report }) =>
              report && (
                <CleanupResults
                  key={environment.environmentId}
                  report={report}
                  environmentLabel={
                    connectedEnvironments.length > 1 ? environment.label : undefined
                  }
                />
              ),
          )}
        </FoldedSettingsSection>
      )}
    </SettingsSection>
  );
}

export function StorageSettingsPanel() {
  const { t: uiT } = useUiLanguage();
  const { scope, connectedEnvironments, targets, target } = useSettingsScope();
  const scopedSettings = useScopedSettings();
  const isProjectScope = scope.kind === "project" || scope.kind === "checkout";
  const settings = {
    ...scopedSettings.storageCleanup,
    ...resolveWorktreeCleanup(scopedSettings, null),
  };
  const projectMode = (entry: ScopedSettingsTarget | null) =>
    entry?.sources.worktreeCleanup === "project"
      ? (entry.settings.worktreeCleanup?.mode ?? "inherit")
      : "inherit";
  const mode = projectMode(target);
  const mixedModes = targets.some((entry) => projectMode(entry) !== mode);
  const updateSettings = useUpdateScopedSettings();
  const clearSettings = useClearScopedSettings();
  const ruleStatus = (key: keyof StorageCleanupSettings) =>
    targets.some(
      (target) =>
        ({ ...target.settings.storageCleanup, ...resolveWorktreeCleanup(target.settings, null) })[
          key
        ] !== settings[key],
    )
      ? "Mixed across selected machines"
      : undefined;
  const update = (patch: Partial<StorageCleanupSettings>) =>
    updateSettings({ storageCleanup: patch });
  const updateWorktree = (patch: Partial<WorktreeCleanupRules>) =>
    isProjectScope
      ? updateSettings({ worktreeCleanup: { mode: "custom", rules: patch } })
      : update(patch);

  if (
    isProjectScope &&
    connectedEnvironments.some(
      (environment) =>
        environment.serverConfig?.environment.capabilities.projectWorktreeCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice target="all">
        {uiT("Update the selected machines to configure project worktree cleanup.")}
      </SettingsScopeNotice>
    );
  }

  if (
    connectedEnvironments.some(
      (environment) => environment.serverConfig?.environment.capabilities.storageCleanup !== true,
    )
  ) {
    return (
      <SettingsScopeNotice
        target="environment"
        eligibleEnvironmentIds={connectedEnvironments
          .filter(
            (environment) =>
              environment.serverConfig?.environment.capabilities.storageCleanup === true,
          )
          .map((environment) => environment.environmentId)}
      >
        {uiT(
          "Update the selected environments to use storage cleanup, or choose a machine that supports it.",
        )}
      </SettingsScopeNotice>
    );
  }

  return (
    <SettingsPageContainer>
      <SettingsSection id="storage-worktrees" title={uiT("Worktrees")}>
        {!isProjectScope && <WorktreesDirectoryRow />}
        {isProjectScope && (
          <SettingsRow
            title={uiT("Automatic worktree cleanup")}
            description={
              mode === "off"
                ? uiT("Keep this project's worktrees until you delete them manually.")
                : mode === "custom"
                  ? uiT("Use these rules for this project.")
                  : uiT("Use each machine's worktree cleanup settings.")
            }
            serverScoped
            settingKeys={["worktreeCleanup"]}
            mixed={mixedModes}
            control={
              <Select
                value={mixedModes ? null : mode}
                onValueChange={(next) => {
                  if (next === "inherit") clearSettings(["worktreeCleanup"]);
                  else if (next === "off") updateSettings({ worktreeCleanup: { mode: "off" } });
                  else if (next === "custom")
                    updateSettings({ worktreeCleanup: { mode: "custom", rules: {} } });
                }}
              >
                <SelectTrigger size="sm" aria-label={uiT("Automatic worktree cleanup")}>
                  <SelectValue>
                    {mixedModes
                      ? uiT("Mixed")
                      : mode === "inherit"
                        ? uiT("Inherit")
                        : mode === "off"
                          ? uiT("Off")
                          : uiT("Custom")}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  <SelectItem value="inherit">{uiT("Inherit")}</SelectItem>
                  <SelectItem value="off">{uiT("Off")}</SelectItem>
                  <SelectItem value="custom">{uiT("Custom")}</SelectItem>
                </SelectPopup>
              </Select>
            }
          />
        )}
        {(!isProjectScope || (!mixedModes && mode === "custom")) && (
          <>
            <SettingsRow
              title={uiT("Delete worktrees with deleted threads")}
              status={ruleStatus("worktreeOnDelete")}
              description={uiT(
                "Remove unused worktrees when active or archived threads are deleted. Worktrees with local changes are kept.",
              )}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={uiT("Delete worktrees with deleted threads")}
                  checked={settings.worktreeOnDelete}
                  onCheckedChange={(worktreeOnDelete) => updateWorktree({ worktreeOnDelete })}
                />
              }
            />
            <SettingsRow
              title={uiT("Delete inactive worktrees")}
              status={ruleStatus("worktreeAfterDays")}
              description={uiT(
                "Remove worktrees after their threads have been inactive for this many days. Branches and thread history are kept.",
              )}
              serverScoped={!isProjectScope}
              control={
                <RetentionControl
                  label={uiT("Delete inactive worktrees")}
                  value={settings.worktreeAfterDays}
                  onChange={(worktreeAfterDays) => updateWorktree({ worktreeAfterDays })}
                />
              }
            />
            <SettingsRow
              title={uiT("Delete merged worktrees")}
              status={ruleStatus("worktreeOnMerge")}
              description={uiT(
                "Remove worktrees whose pull request is merged and whose commits are included in the default branch.",
              )}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={uiT("Delete merged worktrees")}
                  checked={settings.worktreeOnMerge}
                  onCheckedChange={(worktreeOnMerge) => updateWorktree({ worktreeOnMerge })}
                />
              }
            />
            <SettingsRow
              title={uiT("Delete unchanged worktrees")}
              status={ruleStatus("worktreeUnchanged")}
              description={uiT("Remove worktrees with no commits beyond the default branch.")}
              serverScoped={!isProjectScope}
              control={
                <Switch
                  aria-label={uiT("Delete unchanged worktrees")}
                  checked={settings.worktreeUnchanged}
                  onCheckedChange={(worktreeUnchanged) => updateWorktree({ worktreeUnchanged })}
                />
              }
            />
            {connectedEnvironments.every(
              (environment) =>
                environment.serverConfig?.environment.capabilities.storageCleanupRun === true,
            ) && (
              <SettingsRow
                {...searchableSetting("storage-worktree-keep-when")}
                status={ruleStatus("worktreeKeepWhen")}
                description={
                  settings.worktreeKeepWhen === "any-local-files"
                    ? uiT("Includes ignored files, except node_modules.")
                    : settings.worktreeKeepWhen === "tracked-changes"
                      ? uiT("Deletes untracked and ignored files, including .env.")
                      : uiT(
                          "Keeps edits and untracked files. Deletes ignored files, including .env.",
                        )
                }
                serverScoped={!isProjectScope}
                control={
                  <Select
                    value={ruleStatus("worktreeKeepWhen") ? null : settings.worktreeKeepWhen}
                    onValueChange={(next) => {
                      if (
                        next === "any-local-files" ||
                        next === "uncommitted-changes" ||
                        next === "tracked-changes"
                      )
                        updateWorktree({ worktreeKeepWhen: next });
                    }}
                  >
                    <SelectTrigger size="sm" aria-label={uiT("Keep worktrees with local changes")}>
                      <SelectValue>
                        {ruleStatus("worktreeKeepWhen")
                          ? uiT("Mixed")
                          : uiT(KEEP_WHEN_LABELS[settings.worktreeKeepWhen])}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup align="end" alignItemWithTrigger={false}>
                      <SelectItem value="any-local-files">{uiT("Any local files")}</SelectItem>
                      <SelectItem value="uncommitted-changes">
                        {uiT("Uncommitted changes")}
                      </SelectItem>
                      <SelectItem value="tracked-changes">{uiT("Edited tracked files")}</SelectItem>
                    </SelectPopup>
                  </Select>
                }
              />
            )}
          </>
        )}
      </SettingsSection>

      {!isProjectScope && (
        <SettingsSection id="storage-artifacts" title={uiT("Artifacts and logs")}>
          <SettingsRow
            title={uiT("Delete old browser artifacts")}
            status={ruleStatus("browserArtifactsAfterDays")}
            description={uiT(
              "Delete saved browser captures after this many days. Older capture links will no longer open.",
            )}
            serverScoped
            control={
              <RetentionControl
                label={uiT("Delete old browser artifacts")}
                value={settings.browserArtifactsAfterDays}
                onChange={(browserArtifactsAfterDays) => update({ browserArtifactsAfterDays })}
              />
            }
          />
          <SettingsRow
            title={uiT("Delete old rotated logs")}
            status={ruleStatus("logsAfterDays")}
            description={uiT(
              "Delete inactive rotated log files after this many days. Current logs are kept.",
            )}
            serverScoped
            control={
              <RetentionControl
                label={uiT("Delete old rotated logs")}
                value={settings.logsAfterDays}
                onChange={(logsAfterDays) => update({ logsAfterDays })}
              />
            }
          />
        </SettingsSection>
      )}
      {!isProjectScope && <CleanupSection />}
    </SettingsPageContainer>
  );
}
