import { describe, expect, it } from "vite-plus/test";
import { MessageId } from "@t3tools/contracts";
import type { MessagesTimelineRow } from "./MessagesTimeline.logic";
import { deriveTimelineMinimapItems, resolveTimelineMinimapPreview } from "./timelineMinimapItems";
import type { ChatMessage } from "../../types";

function rows(
  entries: ReadonlyArray<readonly ["user" | "assistant", string]>,
): MessagesTimelineRow[] {
  const messages: ChatMessage[] = entries.map(([role, text], index) => ({
    id: MessageId.make(`message-${index}`),
    role,
    text,
    streaming: false,
    runId: null,
    createdAt: new Date(index * 1000).toISOString(),
    updatedAt: new Date(index * 1000).toISOString(),
  }));
  return messages.map((message) => ({
    kind: "message",
    id: message.id,
    createdAt: message.createdAt,
    message,
    durationStart: message.createdAt,
    showAssistantMeta: false,
    showAssistantCopyButton: false,
    assistantCopyStreaming: false,
  }));
}

describe("timeline minimap previews", () => {
  it("separates Latin and numeric sentence boundaries without changing Markdown code or destinations", () => {
    const text =
      "זאת פסקה ארוכה בעברית עם סוף ending. and תחילת משפט חדש בעברית 123: 456 ועוד המשך. " +
      '`keep. code` [קישור](https://example.test/keep "ending. and")';
    const [item] = deriveTimelineMinimapItems(
      rows([
        ["user", text],
        ["assistant", text],
      ]),
    );
    const preview = resolveTimelineMinimapPreview(item!)!;
    expect(preview.userText).toContain("ending. \u200fand");
    expect(preview.assistantText).toContain("123: \u200f456");
    expect(preview.assistantText).toContain("keep. code");
    expect(preview.assistantText).not.toContain("keep. \u200fcode");
    expect(preview.assistantText).not.toContain("https://example.test/");
    expect(preview.assistantText).toContain("קישור");
    expect(item!.userText).toBe(text);
    expect(item!.assistantText).toBe(text);
  });

  it("keeps English paragraphs unchanged even beside a Hebrew paragraph", () => {
    const english = "English ending. and another English sentence.";
    const hebrew = "פסקה ארוכה בעברית עם מילה ending. and המשך בעברית";
    const [item] = deriveTimelineMinimapItems(rows([["user", `${english}\n\n${hebrew}`]]));
    expect(resolveTimelineMinimapPreview(item!)?.userText).toBe(
      `${english} פסקה ארוכה בעברית עם מילה ending. \u200fand המשך בעברית`,
    );
  });

  it("previews the last assistant response before the next prompt and retains jump targets", () => {
    const source = rows([
      ["user", "  Inspect\n this  "],
      ["assistant", "Working"],
      ["assistant", " Done\t now "],
      ["user", "Next"],
      ["assistant", "Second answer"],
    ]);
    const items = deriveTimelineMinimapItems(source);
    expect(items).toHaveLength(2);
    expect(resolveTimelineMinimapPreview(items[0]!)).toEqual({
      ...items[0],
      userText: "Inspect this",
      assistantText: "Done now",
      userDirection: "ltr",
      assistantDirection: "ltr",
    });
    expect(source[items[0]!.rowIndex]!.id).toBe(items[0]!.id);
    expect(resolveTimelineMinimapPreview(items[1]!)?.assistantText).toBe("Second answer");
    expect(items[0]?.assistantText).toBe(" Done\t now ");
  });

  it("handles an unanswered prompt, empty responses, and a closed preview", () => {
    const items = deriveTimelineMinimapItems(
      rows([
        ["user", "First"],
        ["assistant", " \n\t"],
        ["user", "Next"],
      ]),
    );
    expect(items.map((item) => resolveTimelineMinimapPreview(item)?.assistantText)).toEqual([
      null,
      null,
    ]);
    expect(resolveTimelineMinimapPreview(null)).toBeNull();
  });

  it("shows fresh streaming text without changing the jump target", () => {
    const first = deriveTimelineMinimapItems(
      rows([
        ["user", "Explain"],
        ["assistant", "First"],
      ]),
    )[0]!;
    const next = { ...first, assistantText: "First\n second" };
    expect(resolveTimelineMinimapPreview(next)).toEqual({
      ...first,
      assistantText: "First second",
      userDirection: "ltr",
      assistantDirection: "ltr",
    });
    expect(resolveTimelineMinimapPreview(first)?.assistantText).toBe("First");
  });

  it("uses each message's language majority even when Hebrew starts with English", () => {
    const items = deriveTimelineMinimapItems(
      rows([
        ["user", "תרשום לי את הכלל המלא שהבנת"],
        ["assistant", "RTL, כשמילה באנגלית או מספר מופיעים משני צדי מפריד מוסיפים סימן"],
        ["user", "Explain the next part in English"],
        ["assistant", "זאת תשובה בעברית עם דוגמה"],
        ["user", "וזאת עוד בקשה בעברית"],
        ["assistant", "This answer uses English with one Hebrew word שלום"],
      ]),
    );
    expect(
      items.map((item) => {
        const preview = resolveTimelineMinimapPreview(item)!;
        return [preview.userDirection, preview.assistantDirection];
      }),
    ).toEqual([
      ["rtl", "rtl"],
      ["ltr", "rtl"],
      ["rtl", "ltr"],
    ]);
  });

  it("ignores code and hidden link destinations when choosing preview direction", () => {
    const [item] = deriveTimelineMinimapItems(
      rows([
        ["user", "בקשה קצרה `a very long English code example`"],
        [
          "assistant",
          "ראיות: [סיום ההתקנה](/home/ttv20/Projects/wine/fixed-install-after-exit.png)",
        ],
      ]),
    );
    expect(resolveTimelineMinimapPreview(item!)?.userDirection).toBe("rtl");
    expect(resolveTimelineMinimapPreview(item!)?.assistantDirection).toBe("rtl");
  });
});

describe("resolveTimelineMinimapPreview", () => {
  it("previews a thread autolink as prose, not its URL", () => {
    const preview = resolveTimelineMinimapPreview({
      id: "turn-1",
      rowIndex: 0,
      userText: null,
      assistantText:
        "Started <t3-thread://v2/env-1/thread-1> and [Fix CI](t3-thread://v2/env-1/t2).",
    });
    expect(preview?.assistantText).toBe("Started a thread and Fix CI.");
  });
});
