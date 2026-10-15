import { useUiLanguage } from "../../i18n";
import type { ReactElement } from "react";
import { AppSheet } from "../../components/AppSheet";

export interface WorktreeSetupSheetProps {
  children: ReactElement;
  height: number;
  onClose: () => void;
}

export function WorktreeSetupSheet({ children, onClose }: WorktreeSetupSheetProps) {
  const { t: uiT } = useUiLanguage();
  return (
    <AppSheet title={uiT("Worktree setup")} onClose={onClose}>
      {children}
    </AppSheet>
  );
}
