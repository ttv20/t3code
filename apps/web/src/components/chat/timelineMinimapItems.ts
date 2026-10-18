import type { MessagesTimelineRow } from "./MessagesTimeline.logic";
import { markdownWithRtlSentenceBoundaries } from "@t3tools/client-runtime/markdown-rtl";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import {
  countMarkdownDirectionCharacters,
  resolveMarkdownDirection,
} from "@t3tools/client-runtime/markdown-direction";

const previewParser = unified().use(remarkParse).use(remarkGfm);

export interface TimelineMinimapItem {
  readonly id: string;
  readonly rowIndex: number;
  readonly userText: string | null;
  readonly assistantText: string | null;
}

/** Keep full source text untouched until a minimap preview is opened. */
export function deriveTimelineMinimapItems(
  rows: ReadonlyArray<MessagesTimelineRow>,
): TimelineMinimapItem[] {
  const items: TimelineMinimapItem[] = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row?.kind !== "message" || row.message.role !== "user") {
      continue;
    }

    items.push({
      id: row.id,
      rowIndex: index,
      userText: row.message.text,
      assistantText: resolveFinalAssistantTextForTurn(rows, index),
    });
  }
  return items;
}

function resolveFinalAssistantTextForTurn(
  rows: ReadonlyArray<MessagesTimelineRow>,
  userRowIndex: number,
) {
  let finalAssistantText: string | null = null;
  for (let index = userRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (row?.kind !== "message") {
      continue;
    }
    if (row.message.role === "user") {
      break;
    }
    if (row.message.role === "assistant") {
      finalAssistantText = row.message.text ?? null;
    }
  }
  return finalAssistantText;
}

function compactMinimapPreview(text: string | null | undefined) {
  if (!text) return null;
  const displayText = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u.test(text)
    ? markdownWithRtlSentenceBoundaries(text, previewParser.parse(text))
    : text;
  const compact = displayText.replace(/\s+/g, " ").trim();
  return compact.length > 0 ? compact : null;
}

export function resolveTimelineMinimapPreview(item: TimelineMinimapItem | null) {
  return item === null
    ? null
    : {
        ...item,
        userText: compactMinimapPreview(item.userText),
        assistantText: compactMinimapPreview(item.assistantText),
        userDirection: resolveMarkdownDirection(
          countMarkdownDirectionCharacters(item.userText ?? ""),
        ),
        assistantDirection: resolveMarkdownDirection(
          countMarkdownDirectionCharacters(item.assistantText ?? ""),
        ),
      };
}
