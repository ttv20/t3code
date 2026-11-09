import { cn } from "~/lib/utils";
import { UiText } from "../i18n";

import { CommandBlock } from "./CommandBlock";

/**
 * Setup steps for another computer: install `t3`, then run `command`. Both installers are shown
 * because the browser showing this is often not the computer being set up.
 */
export function InstallT3Commands({
  command,
  className,
}: {
  readonly command: string;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        <UiText message={"macOS, Linux"} />
      </p>
      <CommandBlock command="curl -fsSL https://t3.codes/install.sh | sh" />
      <p className="text-xs text-muted-foreground">
        <UiText message={"Windows (PowerShell)"} />
      </p>
      <CommandBlock command="irm https://t3.codes/install.ps1 | iex" />
      <p className="text-xs text-muted-foreground">
        <UiText message={"Then"} />
      </p>
      <CommandBlock command={command} />
      <p className="text-xs text-muted-foreground">
        <UiText
          message={
            "Skip the install if you already have {0}. If  {1} is not found after installing, add the folder the installer names to your PATH."
          }
          values={{
            0: <code className="font-mono">t3</code>,
            1: <code className="font-mono">t3</code>,
          }}
        />
      </p>
    </div>
  );
}
