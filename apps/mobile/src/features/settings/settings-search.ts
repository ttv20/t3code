import { INTERFACE_LANGUAGES, uiSearchTerms, type UiLocale } from "@t3tools/client-runtime/i18n";
import { foldSearchQuery, rankSearchItems, scoreSearchTerms } from "@t3tools/shared/paletteSearch";

import type { SettingsPageTarget } from "./components/settings-page-targets";

/** What each page holds besides its row's label, so search finds a setting by its own name. */
const SETTINGS_SEARCH_TERMS = {
  account: ["T3 Account", "sign in", "sign out", "login", "clerk", "connect"],
  SettingsEnvironments: [
    "Environments",
    "servers",
    "connections",
    "pair",
    "add environment",
    "remote",
    "tailscale",
  ],
  SettingsNotifications: ["Notifications", "push", "alerts", "live activity", "agent activity"],
  SettingsAppearance: [
    "Appearance",
    "theme",
    "dark mode",
    "light mode",
    "colors",
    "font size",
    "text size",
    "code",
    "diffs",
    "terminal",
    "word break",
    "math",
    "tool calls in chat",
    "hide tool calls",
    "commands edits searches",
    "work log",
    "zen",
    "final answers only",
  ],
  SettingsLanguage: [
    ...INTERFACE_LANGUAGES.map(({ label }) => label),
    "Language",
    "language",
    "locale",
    "translation",
    "english",
    "Interface language",
    "Interface direction",
    "Hebrew",
    "Arabic",
    "Persian",
    "RTL",
    "LTR",
  ],
  SettingsNavigation: ["Navigation tabs", "tabs", "tab order", "reorder", "hide tabs"],
  SettingsKeyboard: ["Keyboard", "return key", "send message", "new line", "hardware keyboard"],
  SettingsVoice: [
    "Voice",
    "microphone",
    "dictation",
    "transcription",
    "transcribe on",
    "transcription model",
    "this device",
    "environment",
    "on-device",
    "audio input",
    "preferred microphone",
    "microphone order",
    "bluetooth",
  ],
  SettingsScheduledTasks: [
    "Scheduled tasks",
    "automations",
    "schedule",
    "cron",
    "recurring",
    "webhook",
  ],
  SettingsProjectOverview: ["Projects", "project", "overview", "checkouts", "delete project"],
  SettingsOrganization: [
    "General",
    "project grouping",
    "group projects",
    "organization",
    "sidebar",
    "working section",
    "new threads",
    "last project",
  ],
  SettingsThreads: [
    "Threads",
    "new threads",
    "default workspace",
    "default permissions",
    "access",
    "response streaming",
    "preview browser",
    "browser access",
    "auto-settle",
    "settle",
    "snooze",
    "usage limits",
    "auto-resume",
    "thread behavior",
  ],
  SettingsFollowUp: ["Chat", "follow-ups", "queue", "steer", "while the agent is running"],
  SettingsArchive: ["Archive", "archive", "archived", "restore", "unarchive"],
  SettingsProviderAccounts: [
    "Providers",
    "provider accounts",
    "codex",
    "claude",
    "cursor",
    "opencode",
    "sign in",
    "login",
    "auth",
  ],
  SettingsEnvironmentSourceControl: [
    "Source control",
    "git",
    "pull requests",
    "co-authors",
    "agent credits",
    "default branch",
    "automatically pull",
    "clone into host folders",
    "ghq",
  ],
  SettingsWorktrees: [
    "Worktrees",
    "worktree",
    "branch naming",
    "branch prefix",
    "submodules",
    "start from remote",
  ],
  SettingsLabs: [
    "Labs",
    "beta",
    "linked environments",
    "link machine",
    "fast worktree checkout",
    "clone cache",
  ],
  SettingsEnvironmentMaintenance: [
    "Maintenance",
    "updates",
    "provider updates",
    "restart",
    "manage environments",
  ],
  SettingsAbout: [
    "About",
    "version",
    "diagnostics",
    "client storage",
    "cache",
    "legal",
    "privacy",
    "terms",
    "open source licenses",
  ],
} satisfies Partial<Record<SettingsPageTarget | "account", readonly string[]>>;
const termsById: ReadonlyMap<string, readonly string[]> = new Map(
  Object.entries(SETTINGS_SEARCH_TERMS),
);

export interface SettingsSearchRow {
  readonly id: string;
  readonly label: string;
}

export interface SettingsSearchSection<Row extends SettingsSearchRow> {
  readonly title?: string;
  readonly rows: readonly Row[];
}

/**
 * Keeps the rows whose label, section, or page contents match `query`, in list order, and drops
 * sections left empty. Matching is the command palette's, so both searches agree.
 */
export function filterSettingsSections<
  Row extends SettingsSearchRow,
  Section extends SettingsSearchSection<Row>,
>(sections: readonly Section[], query: string, locale: UiLocale = "en"): Section[] {
  const normalizedQuery = foldSearchQuery(query);
  const rows = sections.flatMap((section) =>
    section.rows.map((row) => ({ row, section: section.title })),
  );
  const matched = normalizedQuery
    ? new Set(
        rankSearchItems(rows, ({ row, section }, options) =>
          scoreSearchTerms(
            normalizedQuery,
            uiSearchTerms(locale, [
              row.label,
              ...(section ? [section] : []),
              ...(termsById.get(row.id) ?? []),
            ]),
            options,
          ),
        ).map(({ item }) => item.row),
      )
    : null;
  return sections.flatMap((section) => {
    const kept = matched ? section.rows.filter((row) => matched.has(row)) : section.rows;
    return kept.length ? [{ ...section, rows: kept }] : [];
  });
}
