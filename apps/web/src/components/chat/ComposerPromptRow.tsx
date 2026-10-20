import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function ComposerPromptRow({
  resting,
  actionsWidth,
  children,
}: {
  resting: boolean;
  actionsWidth: number | null;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative", resting && "flex min-w-0 items-center gap-1")}
      style={
        resting && actionsWidth !== null
          ? { paddingInlineEnd: `calc(${actionsWidth}px + 1rem)` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
