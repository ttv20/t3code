import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { Toast } from "../../components/ui/Toast";
import { useBarInset } from "../../components/ui/useBarInset";
import { useUiLanguage } from "../../i18n";
import { MOBILE_MOTION } from "../../lib/designTokens";
import { tryOpenExternalUrl } from "../../lib/openExternalUrl";
import type { GitActionProgress } from "../../state/use-vcs-action-state";

export function GitActionProgressOverlay(props: {
  readonly progress: GitActionProgress;
  readonly onDismiss: () => void;
  readonly onOpenPullRequest?: (url: string) => Promise<boolean>;
}) {
  const { t: uiT } = useUiLanguage();

  const { progress, onDismiss } = props;
  const openPullRequest = props.onOpenPullRequest;
  const top = useBarInset() + 8;
  const handlePress = () => {
    if (progress.prUrl) {
      void (openPullRequest
        ? openPullRequest(progress.prUrl)
        : tryOpenExternalUrl(progress.prUrl, "pull-request"));
      return;
    }
  };

  if (progress.phase === "idle") {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(MOBILE_MOTION.enter).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(MOBILE_MOTION.exit).reduceMotion(ReduceMotion.System)}
      className="absolute inset-x-3 z-[100]"
      style={{ top }}
      pointerEvents="box-none"
      onAccessibilityEscape={onDismiss}
    >
      <Toast
        singleLine
        message={progress.label ?? uiT("Source control")}
        description={progress.description ?? undefined}
        tone={
          progress.phase === "error"
            ? "danger"
            : progress.phase === "success"
              ? "success"
              : "default"
        }
        busy={progress.phase === "running"}
        action={progress.prUrl ? { label: uiT("View"), onPress: handlePress } : undefined}
      />
    </Animated.View>
  );
}
