import { useUiLanguage } from "../i18n";
import {
  AuthOrchestrationOperateScope,
  type EditorId,
  type EnvironmentId,
} from "@t3tools/contracts";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";

import { useOpenInPreferredEditor } from "../editorPreferences";
import { useEnvironmentScope } from "../state/session";
import { Button } from "./ui/button";
import { stackedThreadToast, toastManager } from "./ui/toast";

export function KeybindingsConfigWarning({
  message,
  environmentId,
  configPath,
  availableEditors,
}: {
  message: string;
  environmentId: EnvironmentId | null;
  configPath: string | null;
  availableEditors: readonly EditorId[];
}) {
  const { t: uiT } = useUiLanguage();
  const canOpenEditor = useEnvironmentScope(environmentId, AuthOrchestrationOperateScope);
  const openInEditor = useOpenInPreferredEditor(environmentId, availableEditors);

  return (
    <>
      {message}
      <span className="mt-2 flex justify-end">
        <Button
          size="xs"
          variant="outline"
          disabled={!canOpenEditor || !configPath || availableEditors.length === 0}
          onClick={async () => {
            if (!configPath) return;
            const result = await openInEditor(configPath);
            if (result._tag === "Success") return;
            const error = squashAtomCommandFailure(result);
            toastManager.add(
              stackedThreadToast({
                type: "error",
                title: uiT("Unable to open keybindings file"),
                description:
                  error instanceof Error ? error.message : uiT("Unknown error opening file."),
              }),
            );
          }}
        >
          {uiT("Open keybindings.json")}
        </Button>
      </span>
    </>
  );
}
