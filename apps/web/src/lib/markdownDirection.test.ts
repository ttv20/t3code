import { describe, expect, it } from "vite-plus/test";
import {
  countMarkdownDirectionCharacters,
  resolveMarkdownDirection,
  resolveStreamingMarkdownDirection,
  startsWithRtlLetter,
} from "@t3tools/client-runtime/markdown-direction";

describe("message direction", () => {
  it("keeps technical Hebrew questions and answer choices RTL even when they start with Latin text", () => {
    for (const text of [
      "Qt API: רשימת פעולות פנימית לשיפור הודעה יש שתי גישות איזו גישה אתה מעדיף להצעת KDE?",
      "Qt API פנימי כדי להציג התאמות מדויקות עם בדיקות",
      "ציבורי ותחזוקה פשוטה API להעדיף",
      "בחירה קצרה `very long English code example`",
    ]) {
      expect(resolveMarkdownDirection(countMarkdownDirectionCharacters(text))).toBe("rtl");
    }
    expect(resolveMarkdownDirection(countMarkdownDirectionCharacters("123"), "rtl")).toBe("rtl");
    expect(
      resolveMarkdownDirection(countMarkdownDirectionCharacters("Use the public API"), "rtl"),
    ).toBe("ltr");
  });
  it("uses all visible letters rather than only the first paragraph", () => {
    const counts = countMarkdownDirectionCharacters("English\n\nשלום עולם ועוד מילים 123!?");
    expect(resolveMarkdownDirection(counts)).toBe("rtl");
    expect(countMarkdownDirectionCharacters("123!?\n ")).toEqual({ ltr: 0, rtl: 0 });
  });

  it("uses an inclusive 30 percent threshold independently of interface direction", () => {
    for (const fallback of ["ltr", "rtl"] as const) {
      expect(resolveMarkdownDirection({ ltr: 70, rtl: 30 }, fallback)).toBe("rtl");
      expect(resolveMarkdownDirection({ ltr: 71, rtl: 29 }, fallback)).toBe("ltr");
      expect(resolveMarkdownDirection({ ltr: 50, rtl: 50 }, fallback)).toBe("rtl");
      expect(resolveMarkdownDirection({ ltr: 0, rtl: 0 }, fallback)).toBe(fallback);
    }
  });

  it("keeps streaming direction near 30 percent and settles to the exact threshold", () => {
    expect(resolveStreamingMarkdownDirection({ ltr: 71, rtl: 29 }, "rtl")).toBe("rtl");
    expect(resolveStreamingMarkdownDirection({ ltr: 69, rtl: 31 }, "ltr")).toBe("ltr");
    expect(resolveStreamingMarkdownDirection({ ltr: 80, rtl: 20 }, "rtl")).toBe("ltr");
    expect(resolveStreamingMarkdownDirection({ ltr: 60, rtl: 40 }, "ltr")).toBe("rtl");
    expect(resolveMarkdownDirection({ ltr: 71, rtl: 29 })).toBe("ltr");
    expect(resolveMarkdownDirection({ ltr: 70, rtl: 30 })).toBe("rtl");
  });

  it("recognizes RTL line starts after punctuation, numbers and emoji", () => {
    for (const text of ["שלום English English", "123. שלום", "✅ العربية", "(فارسی)"]) {
      expect(startsWithRtlLetter(text)).toBe(true);
    }
    expect(startsWithRtlLetter("English שלום")).toBe(false);
    expect(startsWithRtlLetter("123?!")).toBe(false);
  });

  it("does not let inline code choose the message direction", () => {
    expect(countMarkdownDirectionCharacters("שלום `english english english` עולם")).toEqual({
      ltr: 0,
      rtl: 8,
    });
    expect(countMarkdownDirectionCharacters("English `שלום שלום שלום` text")).toEqual({
      ltr: 11,
      rtl: 0,
    });
    expect(countMarkdownDirectionCharacters("English `unclosed שלום")).toEqual({
      ltr: 15,
      rtl: 4,
    });
    expect(countMarkdownDirectionCharacters("English \\`שלום\\` text")).toEqual({
      ltr: 11,
      rtl: 4,
    });
  });

  it("does not count hidden Markdown link and image destinations", () => {
    expect(
      countMarkdownDirectionCharacters(
        "ראיות: [סיום ההתקנה](/home/ttv20/Projects/wine/fixed-install-after-exit.png)",
      ),
    ).toEqual({ ltr: 0, rtl: 15 });
    expect(
      resolveMarkdownDirection(
        countMarkdownDirectionCharacters("ראיות: ![צילום](/home/very/long/english/path/image.png"),
      ),
    ).toBe("rtl");
  });
});
