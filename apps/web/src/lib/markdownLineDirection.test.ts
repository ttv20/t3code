import { describe, expect, it } from "vite-plus/test";
import { rehypeRtlLineDirection } from "./markdownLineDirection";
import {
  countMarkdownDirectionCharacters,
  resolveMarkdownDirection,
} from "@t3tools/client-runtime/markdown-direction";

type Root = Parameters<ReturnType<typeof rehypeRtlLineDirection>>[0];
type ElementContent = Root["children"][number];
type Element = Extract<ElementContent, { type: "element" }>;

const text = (value: string): ElementContent => ({ type: "text", value });
const element = (
  tagName: string,
  children: ElementContent[],
  properties: Element["properties"] = {},
): Element => ({
  type: "element",
  tagName,
  properties,
  children,
});
const transform = (children: Element[]): Root => {
  const tree: Root = { type: "root", children };
  rehypeRtlLineDirection()(tree);
  return tree;
};

describe("local RTL Markdown lines", () => {
  it("right-aligns a Hebrew-starting paragraph inside an English message below the threshold", () => {
    const english =
      "This English explanation is deliberately much longer than the short Hebrew line.";
    const hebrew = "שלום English English";
    expect(
      resolveMarkdownDirection(countMarkdownDirectionCharacters(`${english}\n\n${hebrew}`)),
    ).toBe("ltr");
    const first = element("p", [text(english)]);
    const second = element("p", [text(hebrew)]);
    transform([first, second]);
    expect(first.properties.dir).toBeUndefined();
    expect(second.properties.dir).toBe("rtl");
    expect(second.children).toEqual([text(hebrew)]);
  });

  it("finds the first visible letter across formatting and preserves links and code", () => {
    const link = element("a", [text("العربية")], { href: "https://example.com/english" });
    const code = element("code", [text("const english = 'שלום';")], { dir: "ltr" });
    const heading = element("h2", [text("123. "), element("strong", [link]), text(" English")]);
    const paragraph = element("p", [code, text(" فارسی English")]);
    const pre = element("pre", [element("code", [text("שלום code")])], { dir: "ltr" });
    transform([heading, paragraph, pre]);
    expect(heading.properties.dir).toBe("rtl");
    expect(paragraph.properties.dir).toBe("rtl");
    expect(link.properties.href).toBe("https://example.com/english");
    expect(code.properties.dir).toBe("ltr");
    expect(code.children).toEqual([text("const english = 'שלום';")]);
    expect(pre).toEqual(element("pre", [element("code", [text("שלום code")])], { dir: "ltr" }));
  });

  it("keeps explicit line breaks and inline formatting while directing lines separately", () => {
    const br = element("br", []);
    const paragraph = element("p", [
      element("strong", [text("English"), br, text("שלום English")]),
      br,
      text("More English"),
    ]);
    transform([paragraph]);
    expect(paragraph.properties.dir).toBeUndefined();
    const lines = paragraph.children.filter(
      (node) => node.type === "element" && node.tagName === "span",
    );
    expect(lines.map((line) => (line.type === "element" ? line.properties.dir : null))).toEqual([
      undefined,
      "rtl",
      undefined,
    ]);
    expect(
      paragraph.children.filter((node) => node.type === "element" && node.tagName === "br"),
    ).toHaveLength(2);
    expect(lines[1]).toMatchObject({ children: [element("strong", [text("שלום English")])] });
  });

  it("mirrors RTL list markers and quote gutters and leaves English-only blocks untouched", () => {
    const list = element("ul", [element("li", [text("שלום English English")])]);
    const quote = element("blockquote", [element("p", [text("עברית English")])]);
    const english = element("p", [text("English"), element("br", []), text("More English")]);
    const original = structuredClone(english);
    transform([list, quote, english]);
    expect(list.properties.dir).toBe("rtl");
    expect((list.children[0] as Element).properties.dir).toBe("rtl");
    expect(quote.properties.dir).toBe("rtl");
    expect(english).toEqual(original);
  });

  it("recognizes a new RTL source line after an English soft break", () => {
    const paragraph = element("p", [
      text("Long English introduction\n123. "),
      element("strong", [text("שלום")]),
      text(" English words"),
    ]);
    const english = element("p", [text("An English soft\nwrap remains a paragraph")]);
    const original = structuredClone(english);
    transform([paragraph, english]);
    expect(paragraph.children).toMatchObject([
      { tagName: "span", properties: { className: ["markdown-line"] } },
      { tagName: "br" },
      {
        tagName: "span",
        properties: { dir: "rtl" },
        children: [text("123. "), element("strong", [text("שלום")]), text(" English words")],
      },
    ]);
    expect(english).toEqual(original);
  });

  it("does not turn the newline after a Markdown hard break into an empty line", () => {
    const paragraph = element("p", [text("English"), element("br", []), text("\nשלום English")]);
    transform([paragraph]);
    expect(paragraph.children).toHaveLength(3);
    expect(paragraph.children[2]).toMatchObject({
      properties: { dir: "rtl" },
      children: [text("שלום English")],
    });
  });
});
