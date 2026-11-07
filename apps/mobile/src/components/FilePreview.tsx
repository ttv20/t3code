import { useEffect, useEffectEvent } from "react";
import { Modal, View } from "react-native";
import ImageViewing from "react-native-image-viewing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUiLanguage } from "../i18n";
import { Button } from "./ui/Button";
import * as Dialog from "./ui/Dialog";

import { openAttachmentInViewer } from "../lib/attachmentDownload";
import type {
  ResolvedFilePreviewDocument,
  ResolvedFilePreviewSource,
} from "./FilePreviewModal.types";
import { imageViewingProps, MediaImagePreview } from "./MediaImagePreview";
import { PdfPreview } from "./PdfPreview";
import { AppText as Text } from "./ui/AppText";
import { SheetHeader } from "./ui/SheetHeader";

function PdfDocumentPreview(props: {
  readonly source: ResolvedFilePreviewDocument;
  readonly onRequestClose: () => void;
}) {
  const { t: uiT } = useUiLanguage();

  const insets = useSafeAreaInsets();
  return (
    <Modal
      animationType="slide"
      onRequestClose={props.onRequestClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View
        className="flex-1 bg-card"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <SheetHeader
          presentation="inline"
          title={props.source.name ?? uiT("PDF")}
          onClose={props.onRequestClose}
        />
        <PdfPreview uri={props.source.uri} />
      </View>
    </Modal>
  );
}

function DocumentPreview(props: {
  readonly source: ResolvedFilePreviewDocument;
  readonly onRequestClose: () => void;
  readonly onOpenError?: (error: unknown) => void;
}) {
  const { t: uiT } = useUiLanguage();

  const { uri, name } = props.source;
  const onRequestClose = useEffectEvent(props.onRequestClose);
  const onOpenError = useEffectEvent((error: unknown) => {
    if (props.onOpenError) props.onOpenError(error);
    else
      Dialog.alert(
        uiT("Could not open document"),
        uiT("A compatible viewer must be installed. Check your connection and try again."),
      );
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- opens the attachment in an external viewer and aborts the open on cleanup
  useEffect(() => {
    const controller = new AbortController();
    const input = {
      uri,
      attachment: {
        name: name ?? uiT("Document"),
        mimeType:
          props.source.mimeType ??
          (props.source.kind === "pdf" ? "application/pdf" : "application/octet-stream"),
      },
      signal: controller.signal,
    };
    const opened = openAttachmentInViewer(input);
    void opened
      .catch((error: unknown) => {
        if (!controller.signal.aborted) onOpenError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) onRequestClose();
      });
    return () => controller.abort();
  }, [uri, name, props.source.mimeType, props.source.kind, uiT]);
  return (
    <Modal transparent animationType="fade" onRequestClose={props.onRequestClose}>
      <View className="flex-1 items-center justify-center bg-backdrop p-6">
        <View className="w-full max-w-sm gap-4 rounded-2xl bg-sheet-solid p-6">
          <Text className="font-t3-semibold text-foreground">{uiT("Opening document…")}</Text>
          <Text className="text-foreground-muted" numberOfLines={2}>
            {name ?? uiT("Document")}
          </Text>
          <View className="items-end">
            <Button label={uiT("Cancel")} tone="text" onPress={props.onRequestClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function FilePreview(props: {
  readonly source: ResolvedFilePreviewSource;
  readonly onRequestClose: () => void;
  readonly onOpenError?: (error: unknown) => void;
}) {
  const { source } = props;
  if (source.kind === "pdf") return <PdfDocumentPreview {...props} source={source} />;
  if (source.kind !== "image") return <DocumentPreview {...props} source={source} />;
  if (source.images[source.selectedIndex]?.actionsSource)
    return <MediaImagePreview source={source} onRequestClose={props.onRequestClose} />;
  return (
    <ImageViewing
      {...imageViewingProps(source)}
      visible
      onRequestClose={props.onRequestClose}
      swipeToCloseEnabled={false}
      doubleTapToZoomEnabled
    />
  );
}
