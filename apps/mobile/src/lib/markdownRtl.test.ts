import { describe, expect, it } from "vite-plus/test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkRtlSentenceBoundaries } from "@t3tools/client-runtime/markdown-rtl";
import { markdownForDisplay, type MarkdownNode } from "./markdownDocument";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRtlSentenceBoundaries);

function proseText(node: MarkdownNode): string {
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map(proseText).join("");
  return "";
}

function renderedProse(source: string): string {
  const tree = processor.parse(source);
  processor.runSync(tree);
  return proseText(tree);
}

describe("RTL sentence boundaries", () => {
  it.each([
    ["לדוגמה משפט אחת ending. and השני מתחיל", "לדוגמה משפט אחת ending. \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת ending: and השני מתחיל", "לדוגמה משפט אחת ending: \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת ending. 123 השני מתחיל", "לדוגמה משפט אחת ending. \u200f123 השני מתחיל"],
    ["לדוגמה משפט אחת 123: and השני מתחיל", "לדוגמה משפט אחת 123: \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת 123. 456 השני מתחיל", "לדוגמה משפט אחת 123. \u200f456 השני מתחיל"],
    ["לדוגמה משפט אחת 123: 456 השני מתחיל", "לדוגמה משפט אחת 123: \u200f456 השני מתחיל"],
    ["לדוגמה משפט אחת ending? and השני מתחיל", "לדוגמה משפט אחת ending? \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת ending! and השני מתחיל", "לדוגמה משפט אחת ending! \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת ending.” “and השני מתחיל", "לדוגמה משפט אחת ending.” \u200f“and השני מתחיל"],
    ["לדוגמה משפט אחת ending.\n and השני מתחיל", "לדוגמה משפט אחת ending.\n \u200fand השני מתחיל"],
    ["לדוגמה משפט אחת 1.2. 3.4 השני מתחיל", "לדוגמה משפט אחת 1.2. \u200f3.4 השני מתחיל"],
    [
      "לדוגמה משפט אחת end. next משפט שני 123: 456 משפט שלישי",
      "לדוגמה משפט אחת end. \u200fnext משפט שני 123: \u200f456 משפט שלישי",
    ],
  ])("separates adjacent English/number runs in %s", (source, expected) => {
    expect(markdownForDisplay(source)).toBe(expected);
    expect(renderedProse(source)).toBe(proseText(processor.parse(expected)));
    expect(markdownForDisplay(expected)).toBe(expected);
  });

  it.each([
    "An English sentence ending. and another starts here.",
    "An English paragraph with שלום ending. and more English prose continues here.",
    "לדוגמה משפט אחת בעברית. and השני מתחיל",
    "לדוגמה משפט אחת ending. השני מתחיל",
    "לדוגמה משפט אחת ending.and השני מתחיל",
    "לדוגמה משפט אחת ending. \u200fand השני מתחיל",
    "לדוגמה משפט אחת ending.\n\nand השני מתחיל בעברית עוד מילים",
    "לדוגמה משפט אחת ending.\n\n123 השני מתחיל בעברית עוד מילים",
    "לדוגמה משפט אחת ending. `and השני מתחיל`",
    "לדוגמה משפט אחת `ending. and` השני מתחיל",
    "```text\nלדוגמה משפט אחת ending. and השני מתחיל\n```",
  ])("preserves prose or code that needs no mark: %s", (source) => {
    expect(markdownForDisplay(source)).toBe(source);
    const tree = processor.parse(source);
    expect(processor.runSync(structuredClone(tree))).toEqual(tree);
  });

  it.each([
    [
      "לדוגמה משפט אחת **ending.** **and** השני מתחיל",
      "לדוגמה משפט אחת **ending.** **\u200fand** השני מתחיל",
    ],
    [
      "לדוגמה משפט אחת [ending](https://example.com/end). [and](https://example.com/next) השני מתחיל",
      "לדוגמה משפט אחת [ending](https://example.com/end). [\u200fand](https://example.com/next) השני מתחיל",
    ],
    [
      "לדוגמה משפט אחת end**ing.** a*nd* השני מתחיל",
      "לדוגמה משפט אחת end**ing.** \u200fa*nd* השני מתחיל",
    ],
    ["לדוגמה משפט אחת ending\\. and השני מתחיל", "לדוגמה משפט אחת ending\\. \u200fand השני מתחיל"],
  ])("preserves inline formatting and destinations: %s", (source, expected) => {
    expect(markdownForDisplay(source)).toBe(expected);
    expect(renderedProse(source)).toBe("לדוגמה משפט אחת ending. \u200fand השני מתחיל");
  });

  it("applies independently to headings, list items, quotes, and table cells", () => {
    const sentence = "לדוגמה משפט אחת ending: and השני מתחיל";
    const source = `# ${sentence}\n\n- ${sentence}\n\n> ${sentence}\n\n| תוכן |\n| --- |\n| ${sentence} |`;
    expect(markdownForDisplay(source)).toBe(source.replaceAll("ending: and", "ending: \u200fand"));
    expect(renderedProse(source)).toContain("ending: \u200fand");
  });

  it("handles native HTML prose after converting it to Markdown", () => {
    const source = "<p>לדוגמה משפט אחת ending: <strong>and</strong> השני מתחיל</p>";
    expect(markdownForDisplay(source)).toContain("ending: \u200fand השני מתחיל");
  });
});
