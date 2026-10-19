import { startsWithRtlLetter } from "@t3tools/client-runtime/markdown-direction";
import type { ExtraProps } from "react-markdown";

type Element = NonNullable<ExtraProps["node"]>;
type ElementContent = Element["children"][number];
type Root = { type: "root"; children: ElementContent[] };

const PROSE_BLOCKS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "blockquote",
  "ul",
  "ol",
  "td",
  "th",
]);
const TECHNICAL_BLOCKS = new Set(["pre", "code", "script", "style"]);

function proseText(node: ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type !== "element" || TECHNICAL_BLOCKS.has(node.tagName)) return "";
  return node.children.map(proseText).join("");
}

function splitLines(children: ElementContent[]): ElementContent[][] {
  const lines: ElementContent[][] = [[]];
  let afterBreak = false;
  for (const original of children) {
    // Markdown's hard-break output includes a formatting newline after <br>.
    const child =
      afterBreak && original.type === "text" && original.value.startsWith("\n")
        ? { ...original, value: original.value.slice(1) }
        : original;
    afterBreak = false;
    if (child.type === "element" && child.tagName === "br") {
      lines.push([]);
      afterBreak = true;
      continue;
    }
    if (child.type === "text" && child.value.includes("\n")) {
      for (const [index, value] of child.value.split("\n").entries()) {
        if (index > 0) lines.push([]);
        lines[lines.length - 1]!.push({ ...child, value });
      }
      continue;
    }
    const nested =
      child.type === "element" && !TECHNICAL_BLOCKS.has(child.tagName)
        ? splitLines(child.children)
        : null;
    if (nested && nested.length > 1 && child.type === "element") {
      for (const [index, children] of nested.entries()) {
        if (index > 0) lines.push([]);
        lines[lines.length - 1]!.push({ ...child, children });
      }
    } else {
      lines[lines.length - 1]!.push(child);
    }
  }
  return lines;
}

/** Local RTL lines override an LTR message without changing its Markdown or technical text. */
export function rehypeRtlLineDirection() {
  return (tree: Root) => {
    const visit = (node: Root | Element) => {
      if (node.type === "element" && TECHNICAL_BLOCKS.has(node.tagName)) return;
      for (const child of node.children) {
        if (child.type === "element") visit(child);
      }
      if (node.type !== "element" || !PROSE_BLOCKS.has(node.tagName)) return;
      const rtlStart = startsWithRtlLetter(proseText(node));
      // Containers with nested blocks let those blocks own their lines.
      const nestedBlocks = node.children.some(
        (child) => child.type === "element" && PROSE_BLOCKS.has(child.tagName),
      );
      const lines =
        /^(p|h[1-6]|li|td|th)$/.test(node.tagName) && !nestedBlocks
          ? splitLines(node.children)
          : [node.children];
      if (lines.length < 2) {
        if (rtlStart) node.properties = { ...node.properties, dir: "rtl" };
        return;
      }
      if (!lines.some((line) => startsWithRtlLetter(line.map(proseText).join("")))) return;
      node.children = lines.flatMap((children, index) => {
        const line: Element = {
          type: "element",
          tagName: "span",
          properties: {
            className: ["markdown-line"],
            ...(startsWithRtlLetter(children.map(proseText).join("")) ? { dir: "rtl" } : {}),
          },
          children,
        };
        const breakElement: Element = {
          type: "element",
          tagName: "br",
          properties: {},
          children: [],
        };
        return index === 0 ? [line] : [breakElement, line];
      });
    };
    visit(tree);
  };
}
