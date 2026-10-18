import { useUiLanguage } from "../../i18n";
import type { ReactElement } from "react";
import { Sheet } from "../../components/ui/Sheet";

export interface WorktreeSetupSheetProps {
  children: ReactElement;
  height: number;
  onClose: () => void;
}

export function WorktreeSetupSheet({ children, onClose }: WorktreeSetupSheetProps) {
  const { t: uiT } = useUiLanguage();
  return (
    <Sheet title={uiT("Worktree setup")} onClose={onClose}>
      {children}
    </Sheet>
  );
}
