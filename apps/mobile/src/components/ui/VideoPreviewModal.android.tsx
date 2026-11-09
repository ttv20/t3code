import { videoMimeType } from "@t3tools/shared/video";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUiLanguage } from "../../i18n";

import { useLocalAttachmentPreview } from "../../lib/localAttachmentPreview";
import { type MediaActionsSource } from "../../lib/mediaActionsSource";
import { usePreviewPresentation, videoPreviewKey } from "../../lib/previewPresentation";
import {
  mediaVideoPreviewUri,
  mediaVideoThumbnailKey,
  type LocalVideoPreviewSource,
  type MediaVideoPreviewSource,
  type VideoPreviewSource,
} from "../../lib/videoPreviewSource";
import { useAssetUrlState, useRefreshAssetUrl } from "../../state/assets";
import { useMediaActions } from "../../state/mediaActions";
import { usePreparedConnection } from "../../state/session";
import { MediaPreviewHeader } from "../MediaPreviewHeader";
import { MediaVideoPlayer } from "../MediaVideoPlayer";
import { AppActivityIndicator } from "./AppActivityIndicator";
import { AppText } from "./AppText";

export type { VideoPreviewSource } from "../../lib/videoPreviewSource";

interface PlaybackState {
  readonly uri: string | null;
  readonly resolvePlaybackUri?: () => Promise<string | null>;
  readonly unavailable: boolean;
  readonly error: string | null;
  readonly actionsSource: MediaActionsSource | undefined;
}

function useMediaPlayback(source: MediaVideoPreviewSource): PlaybackState {
  const environmentId = "environmentId" in source ? source.environmentId : null;
  const resource = "resource" in source ? source.resource : null;
  const connection = usePreparedConnection(environmentId);
  const asset = useAssetUrlState(environmentId, resource);
  const refreshAssetUrl = useRefreshAssetUrl(environmentId, resource);
  const uri = mediaVideoPreviewUri(source, asset._tag === "Success" ? asset.url : null);
  return {
    uri,
    ...(resource !== null
      ? { resolvePlaybackUri: async () => mediaVideoPreviewUri(source, await refreshAssetUrl()) }
      : {}),
    unavailable:
      uri === null &&
      environmentId !== null &&
      (connection._tag === "None" || asset._tag === "Failure"),
    error: null,
    actionsSource: source.actionsSource,
  };
}

function useLocalPlayback(source: LocalVideoPreviewSource): PlaybackState {
  const { attachment } = source;
  const preview = useLocalAttachmentPreview(attachment);
  const { uri } = preview;
  const error = preview.error ? preview.error.message || "Could not load this video." : null;
  const mimeType = videoMimeType(attachment) ?? attachment.mimeType;
  return {
    uri,
    unavailable: error !== null,
    error,
    actionsSource: uri === null ? undefined : { name: attachment.name, mimeType, uri },
  };
}

function MediaPreviewModal(props: {
  readonly source: MediaVideoPreviewSource;
  readonly onRequestClose: () => void;
}) {
  return (
    <OpenVideoPreviewModal
      name={props.source.name}
      thumbnailKey={mediaVideoThumbnailKey(props.source)}
      playback={useMediaPlayback(props.source)}
      onRequestClose={props.onRequestClose}
    />
  );
}

function LocalPreviewModal(props: {
  readonly source: LocalVideoPreviewSource;
  readonly onRequestClose: () => void;
}) {
  return (
    <OpenVideoPreviewModal
      name={props.source.attachment.name}
      thumbnailKey={`local:${props.source.attachment.id}`}
      playback={useLocalPlayback(props.source)}
      onRequestClose={props.onRequestClose}
    />
  );
}

function OpenVideoPreviewModal(props: {
  readonly name: string;
  readonly thumbnailKey: string;
  readonly playback: PlaybackState;
  readonly onRequestClose: () => void;
}) {
  const { t: uiT } = useUiLanguage();
  const { playback } = props;
  const insets = useSafeAreaInsets();
  const mediaActions = useMediaActions(playback.actionsSource, props.onRequestClose);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={props.onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        className="flex-1 bg-black"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <MediaPreviewHeader
          title={props.name}
          media={mediaActions}
          closeAccessibilityLabel={uiT("Close video")}
          onClose={props.onRequestClose}
        />
        {playback.uri === null && !playback.unavailable ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <AppActivityIndicator color="#ffffff" />
            <AppText className="text-sm text-white/80">{uiT("Loading video...")}</AppText>
          </View>
        ) : (
          <MediaVideoPlayer
            uri={playback.uri}
            resolvePlaybackUri={playback.resolvePlaybackUri}
            name={props.name}
            thumbnailKey={props.thumbnailKey}
            unavailable={playback.unavailable}
            paused={mediaActions.sharing}
            expanded
            autoPlay
          />
        )}
        {playback.error ? (
          <AppText accessibilityRole="alert" className="px-4 pb-3 text-sm text-white/80">
            {playback.error}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={uiT("Save or share video")}
          disabled={playback.uri === null || mediaActions.sharing}
          onPress={mediaActions.share}
          className="mx-4 my-3 min-h-12 items-center justify-center rounded-xl bg-white/15 px-4"
        >
          <AppText className="font-t3-medium text-base text-white">
            {mediaActions.sharing ? uiT("Opening share sheet...") : uiT("Save or share video")}
          </AppText>
        </Pressable>
      </View>
    </Modal>
  );
}

export function VideoPreviewModal(props: {
  readonly source: VideoPreviewSource | null;
  readonly onRequestClose: () => void;
}) {
  usePreviewPresentation(
    props.source === null ? null : videoPreviewKey(props.source),
    props.onRequestClose,
  );
  const { source } = props;
  if (source === null) return null;
  return source.type === "local" ? (
    <LocalPreviewModal
      key={videoPreviewKey(source)}
      source={source}
      onRequestClose={props.onRequestClose}
    />
  ) : (
    <MediaPreviewModal
      key={videoPreviewKey(source)}
      source={source}
      onRequestClose={props.onRequestClose}
    />
  );
}
