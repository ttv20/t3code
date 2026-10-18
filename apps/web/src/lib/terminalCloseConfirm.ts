import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import { readLocalApi } from "~/localApi";

let pendingConfirmations = 0;

/** Whether a terminal-close confirmation is currently waiting on the user. */
export function isTerminalCloseConfirmPending(): boolean {
  return pendingConfirmations > 0;
}

/**
 * Confirmation for individual terminal close actions: drawer buttons, panel
 * buttons, the `terminal.close` keybinding, and closing a terminal surface from
 * the tab strip. Auto-exit cleanup and bulk tab closes skip this path and close
 * directly.
 */
export async function confirmTerminalClose(
  labels: readonly [string, ...string[]],
  t = createUiTranslator("en"),
): Promise<boolean> {
  const localApi = readLocalApi();
  if (!localApi) return true;
  pendingConfirmations += 1;
  try {
    return await localApi.dialogs.confirm(
      labels.length === 1
        ? [
            t('Close terminal "{0}"?', { "0": labels[0] }),
            "This stops the running process and clears its history.",
          ].join("\n")
        : [
            t("Close {0} terminals?", { "0": labels.length }),
            t("This stops their running processes and clears their histories: {0}.", {
              "0": labels.map((label) => `"${label}"`).join(", "),
            }),
          ].join("\n"),
      { variant: "destructive" },
    );
  } catch {
    return false;
  } finally {
    pendingConfirmations -= 1;
  }
}
