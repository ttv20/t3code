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
});
