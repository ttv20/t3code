import { View } from "react-native";
import { useUiLanguage } from "../../i18n";

import { Notice } from "../../components/ui/Notice";
import { setFreshSessionPending, useComposerDraftSettings } from "../../state/use-composer-drafts";

/** Shown while `/clear` is armed; dismissing it keeps the current session. */
export function FreshSessionNotice(props: { readonly threadKey: string }) {
  const { t: uiT } = useUiLanguage();

  if (useComposerDraftSettings(props.threadKey).freshContext !== true) return null;
  return (
    <View className="px-4 pb-3">
      <Notice
        message={uiT(
          "Your next message starts a fresh session. The agent won't see earlier messages in this thread.",
        )}
        icon="arrow.clockwise"
        floating
        onDismiss={() => setFreshSessionPending(props.threadKey, false)}
        dismissLabel="Keep the current session"
      />
    </View>
  );
}
