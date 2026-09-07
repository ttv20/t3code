import { describe, expect, it } from "vite-plus/test";
import {
  countMarkdownDirectionCharacters,
  resolveMarkdownDirection,
  resolveStreamingMarkdownDirection,
} from "./ChatMarkdown";

describe("message direction", () => {
  it("uses the full message majority rather than its first paragraph", () => {
    const counts = countMarkdownDirectionCharacters("English\n\nשלום עולם ועוד מילים 123!?");
    expect(resolveMarkdownDirection(counts)).toBe("rtl");
    expect(countMarkdownDirectionCharacters("123!?\n ")).toEqual({ ltr: 0, rtl: 0 });
  });

  it("keeps streaming direction through small leads and settles to the exact majority", () => {
    expect(resolveStreamingMarkdownDirection({ ltr: 21, rtl: 20 }, "rtl")).toBe("rtl");
    expect(resolveStreamingMarkdownDirection({ ltr: 32, rtl: 20 }, "rtl")).toBe("ltr");
    expect(resolveMarkdownDirection({ ltr: 21, rtl: 20 })).toBe("ltr");
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
});
