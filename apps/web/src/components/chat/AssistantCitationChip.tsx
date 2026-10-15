import { useUiLanguage } from "../../i18n";
import {
  countMarkdownDirectionCharacters,
  resolveMarkdownDirection,
} from "@t3tools/client-runtime/markdown-direction";
import type { AssistantCitation } from "@t3tools/contracts";
import { serializeAssistantCitation } from "@t3tools/shared/assistantCitations";
import { Link, useNavigate } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  findAssistantCitationSourceAnchor,
  type AssistantCitationSourceAnchor,
} from "~/lib/assistantTextSelection";
import {
  assistantCitationHash,
  assistantCitationNavigation,
} from "../../lib/assistantCitationNavigation";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { AssistantCitationCommentEditor } from "./AssistantCitationCommentEditor";
import { resolveAssistantCitationCommentDismissal } from "./assistantCitationCommentDismissal";
import { observeAssistantCitationCommentSource } from "./AssistantCitationSource";
import { composerFloatingLayerProps } from "./composerEventScope";

export function AssistantCitationChip({
  citation,
  composer = false,
  commentEditor,
}: {
  citation: AssistantCitation;
  composer?: boolean;
  commentEditor?: {
    open: boolean;
    sourceAnchor?: AssistantCitationSourceAnchor | undefined;
    onOpenChange: (open: boolean) => void;
    onCancel?: () => void;
    onSave: (comment: string) => boolean;
    onSaveAndSend?: (comment: string) => boolean;
    /** Reports each keystroke of the unsaved comment. */
    onDraftChange?: (comment: string) => void;
    /** Returns focus to the host editor when the popover closes instead of to the pencil trigger. */
    onRestoreFocus?: () => void;
  };
}) {
  const { t: uiT, direction: uiDirection } = useUiLanguage();
  const navigate = useNavigate();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentPopupRef = useRef<HTMLDivElement>(null);
  const draftCommentRef = useRef<string | null>(null);
  const [unavailableSourceAnchor, setUnavailableSourceAnchor] =
    useState<AssistantCitationSourceAnchor | null>(null);
  const commentOpen = commentEditor?.open ?? false;
  const sourceAnchor = commentEditor?.sourceAnchor;
  const activeSourceAnchor = sourceAnchor === unavailableSourceAnchor ? undefined : sourceAnchor;
  useEffect(() => {
    if (!commentOpen) draftCommentRef.current = null;
  }, [commentOpen]);
  const settleDraftOnClose = (reason: string): boolean => {
    const dismissal = resolveAssistantCitationCommentDismissal({
      reason,
      draft: draftCommentRef.current,
      savedComment: citation.comment,
    });
    if (dismissal.kind === "commit") return commentEditor?.onSave(dismissal.comment) ?? true;
    return dismissal.kind !== "keep-open";
  };
  const onSourceUnavailable = useEffectEvent(() => {
    if (!sourceAnchor) return;
    if (settleDraftOnClose("none")) {
      commentEditor?.onOpenChange(false);
    } else {
      // Keep the draft mounted, positioned at the composer trigger instead of a detached range.
      setUnavailableSourceAnchor(sourceAnchor);
    }
  });
  useEffect(() => {
    if (!commentOpen || sourceAnchor === unavailableSourceAnchor) return;
    const anchor = sourceAnchor ?? findAssistantCitationSourceAnchor(document, citation);
    if (!anchor) return;
    return observeAssistantCitationCommentSource({
      anchor,
      citation,
      onUnavailable: onSourceUnavailable,
    });
  }, [citation, commentOpen, sourceAnchor, unavailableSourceAnchor]);
  const quoteDirection = resolveMarkdownDirection(
    countMarkdownDirectionCharacters(citation.text),
    uiDirection,
  );
  const commentDirection = resolveMarkdownDirection(
    countMarkdownDirectionCharacters(citation.comment ?? ""),
    uiDirection,
  );
  const sourceDirection = activeSourceAnchor?.placement?.direction ?? quoteDirection;
  // Follow the release point as the last selected line moves during scrolling.
  const popupAnchor = activeSourceAnchor
    ? {
        contextElement: activeSourceAnchor.source,
        getBoundingClientRect: () => {
          const rects = activeSourceAnchor.range.getClientRects();
          const line =
            rects.item(rects.length - 1) ?? activeSourceAnchor.range.getBoundingClientRect();
          const offset = activeSourceAnchor.placement?.offset;
          return new DOMRect(
            offset ? line.left + offset.x : sourceDirection === "rtl" ? line.left : line.right,
            offset ? line.top + offset.y : line.bottom,
            0,
            0,
          );
        },
      }
    : undefined;
  const sourceLinkProps = {
    to: "/$environmentId/$threadId" as const,
    params: { environmentId: citation.environmentId, threadId: citation.threadId },
    hash: assistantCitationHash(citation),
    "data-markdown-copy": serializeAssistantCitation(citation),
    resetScroll: false,
    onClick: (event: ReactMouseEvent<HTMLAnchorElement>) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      void navigate(assistantCitationNavigation(citation));
    },
  };
  const quote = (
    <Link
      {...sourceLinkProps}
      dir={quoteDirection}
      className="assistant-citation-excerpt"
      aria-label={uiT("View cited assistant text: {0}", { "0": citation.text })}
      title={citation.text}
    >
      {citation.text}
    </Link>
  );
  if (!composer) {
    return (
      <span
        className="assistant-citation-reply"
        data-assistant-citation-reply="true"
        data-markdown-copy={serializeAssistantCitation(citation)}
      >
        {quote}
        {citation.comment ? (
          <span className="assistant-citation-response" dir={commentDirection}>
            {citation.comment}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className="assistant-citation-card"
      contentEditable={false}
      data-assistant-citation-chip="true"
      data-markdown-copy={serializeAssistantCitation(citation)}
    >
      {quote}
      {citation.comment ? (
        <span className="assistant-citation-response" dir={commentDirection}>
          {citation.comment}
        </span>
      ) : null}
      <span className="assistant-citation-caption">{uiT("Quoted reply")}</span>
      {commentEditor ? (
        <Popover
          open={commentEditor.open}
          onOpenChange={(open, eventDetails) => {
            if (!open && !settleDraftOnClose(eventDetails.reason)) {
              eventDetails.cancel();
              return;
            }
            commentEditor.onOpenChange(open);
          }}
        >
          <span className="assistant-citation-edit">
            <PopoverTrigger
              aria-label={
                citation.comment ? uiT("Edit citation comment") : uiT("Add comment to citation")
              }
              data-citation-comment-trigger="true"
              render={<Button variant="ghost-muted" size="icon-micro" />}
            >
              <PencilIcon aria-hidden="true" />
            </PopoverTrigger>
          </span>
          {commentEditor.open ? (
            <PopoverPopup
              {...composerFloatingLayerProps}
              side={activeSourceAnchor ? (sourceDirection === "rtl" ? "left" : "right") : "top"}
              align={activeSourceAnchor ? "start" : "end"}
              sideOffset={8}
              anchor={popupAnchor}
              initialFocus={() => {
                commentInputRef.current?.focus({ preventScroll: true });
                return false;
              }}
              finalFocus={
                commentEditor.onRestoreFocus
                  ? () => {
                      // Leave focus alone when the user closed the popover by moving to another control.
                      const activeElement = document.activeElement;
                      if (
                        activeElement === document.body ||
                        (activeElement !== null && commentPopupRef.current?.contains(activeElement))
                      ) {
                        commentEditor.onRestoreFocus?.();
                      }
                      return false;
                    }
                  : undefined
              }
              ref={commentPopupRef}
              aria-label={uiT("Edit citation comment")}
              width="md"
              padding="compact"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <AssistantCitationCommentEditor
                key={serializeAssistantCitation(citation)}
                citation={citation}
                inputRef={commentInputRef}
                onDraftChange={(comment) => {
                  draftCommentRef.current = comment;
                  commentEditor.onDraftChange?.(comment);
                }}
                onSubmit={(comment) => {
                  if (!commentEditor.onSave(comment)) return false;
                  commentEditor.onOpenChange(false);
                  return true;
                }}
                {...(commentEditor.onSaveAndSend
                  ? {
                      onSubmitAndSend: (comment: string) => {
                        if (!commentEditor.onSaveAndSend?.(comment)) return false;
                        commentEditor.onOpenChange(false);
                        return true;
                      },
                    }
                  : {})}
                onCancel={() => {
                  if (commentEditor.onCancel) {
                    commentEditor.onCancel();
                  } else {
                    commentEditor.onOpenChange(false);
                  }
                }}
              />
            </PopoverPopup>
          ) : null}
        </Popover>
      ) : null}
    </span>
  );
}
