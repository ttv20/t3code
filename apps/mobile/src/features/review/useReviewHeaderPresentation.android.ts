import { useUiLanguage } from "../../i18n";
import type { useReviewHeaderPresentation as useIosReviewHeaderPresentation } from "./useReviewHeaderPresentation";

export function useReviewHeaderPresentation(
  props: Parameters<typeof useIosReviewHeaderPresentation>[0],
): ReturnType<typeof useIosReviewHeaderPresentation> {
  const { t: uiT } = useUiLanguage();

  return {
    title: uiT("Review changes"),
    subtitle: props.androidSubtitle || "Select a diff",
    gitMenu: null,
    menuIcon: "ellipsis.circle",
    refreshAction: {
      id: "refresh",
      title: uiT("Refresh current diff"),
      disabled: !props.selectedSection || props.selectedSection.isLoading,
      onPress: () => {
        void props.onRefresh();
      },
    },
  };
}
