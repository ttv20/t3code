import { hasRightToLeftLetter } from "~/textDirection";
import { remarkRtlSentenceBoundaries } from "@t3tools/client-runtime/markdown-rtl";
import type { Element, ElementContent, Root } from "hast";

const PROSE_BLOCKS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "td",
  "th",
  "summary",
]);
const INLINE_PROSE = new Set(["a", "em", "strong", "del", "span", "b", "i", "s", "sup", "sub"]);

type ProseNode = { type: string; value?: string; children?: ProseNode[] };

function proseNode(node: ElementContent): ProseNode {
  if (node.type === "text") return node;
  if (
    node.type === "element" &&
    INLINE_PROSE.has(node.tagName) &&
    node.properties.dataMarkdownMath === undefined
  ) {
    return { type: "inline", children: node.children.map(proseNode) };
  }
  return { type: "break" };
}

function hasRtlProse(node: ElementContent): boolean {
  if (node.type === "text") return hasRightToLeftLetter(node.value);
  return (
    node.type === "element" &&
    INLINE_PROSE.has(node.tagName) &&
    node.properties.dataMarkdownMath === undefined &&
    node.children.some(hasRtlProse)
  );
}

const correctSentences = remarkRtlSentenceBoundaries();

/** Share the native sentence rule while mutating only Words' display text nodes. */
export function rehypeRtlSentenceBoundaries(tree: Root | Element): void {
  if (
    tree.type === "element" &&
    (tree.tagName === "pre" || tree.tagName === "code" || tree.tagName === "svg")
  )
    return;
  if (
    tree.type === "element" &&
    PROSE_BLOCKS.has(tree.tagName) &&
    tree.children.some(hasRtlProse)
  ) {
    correctSentences({ type: "paragraph", children: tree.children.map(proseNode) });
  }
  for (const child of tree.children) {
    if (child.type === "element") rehypeRtlSentenceBoundaries(child);
  }
}
