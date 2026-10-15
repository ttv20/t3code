const RTL_LETTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u;
const LETTER = /\p{L}/u;
const SENTENCE_BOUNDARY =
  /[\p{Script=Latin}\p{N}](?:\\?[.!?:…])+["'”’»)]*\s+(?=["'“‘«(]*[\p{Script=Latin}\p{N}])/gu;
const RLM = "\u200f";

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  position?: { start: { offset?: number }; end: { offset?: number } };
};

/** Find boundaries where adjacent Latin/number runs would join across RTL sentences. */
function sentenceBoundaryOffsets(text: string): number[] {
  if (!RTL_LETTER.test(text)) return [];
  let rtl = 0;
  let ltr = 0;
  for (const character of text) {
    if (!LETTER.test(character)) continue;
    if (RTL_LETTER.test(character)) rtl += 1;
    else ltr += 1;
  }
  if (rtl === 0 || ltr > rtl) return [];
  return [...text.matchAll(SENTENCE_BOUNDARY)].map((match) => match.index + match[0].length);
}

function sentenceBoundaryInsertions(tree: MarkdownNode, source?: string) {
  const insertions: Array<{ node: MarkdownNode; offset: number }> = [];
  const visit = (node: MarkdownNode) => {
    if (node.type === "paragraph" || node.type === "heading" || node.type === "tableCell") {
      const spans: Array<{ node: MarkdownNode; start: number; end: number }> = [];
      let text = "";
      const collect = (child: MarkdownNode) => {
        if (child.type === "text" && child.value !== undefined) {
          const start = text.length;
          const sourceStart = child.position?.start.offset;
          const sourceEnd = child.position?.end.offset;
          text +=
            source !== undefined && sourceStart !== undefined && sourceEnd !== undefined
              ? source.slice(sourceStart, sourceEnd)
              : child.value;
          spans.push({ node: child, start, end: text.length });
        } else if (child.children) {
          child.children.forEach(collect);
        } else {
          // Code, images, HTML, and hard breaks separate prose runs. Their contents
          // must not receive marks or influence the paragraph's direction.
          text += "\ufffc";
        }
      };
      node.children?.forEach(collect);
      let spanIndex = 0;
      for (const offset of sentenceBoundaryOffsets(text)) {
        while (spans[spanIndex] && spans[spanIndex]!.end <= offset) spanIndex += 1;
        const span = spans[spanIndex];
        if (span && offset >= span.start)
          insertions.push({ node: span.node, offset: offset - span.start });
      }
      return;
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return insertions;
}

/** Apply only to rendered prose; Markdown destinations and code retain their original values. */
export function remarkRtlSentenceBoundaries() {
  return (tree: MarkdownNode) => {
    const insertions = sentenceBoundaryInsertions(tree);
    for (let index = insertions.length - 1; index >= 0; index -= 1) {
      const { node, offset } = insertions[index]!;
      const value = node.value!;
      node.value = value.slice(0, offset) + RLM + value.slice(offset);
    }
  };
}

/** Preserve source syntax for native renderers that accept Markdown rather than an AST. */
export function markdownWithRtlSentenceBoundaries(source: string, tree: MarkdownNode): string {
  const insertions = sentenceBoundaryInsertions(tree, source);
  for (let index = insertions.length - 1; index >= 0; index -= 1) {
    const { node, offset } = insertions[index]!;
    const start = node.position?.start.offset;
    if (start === undefined) continue;
    const insertionOffset = start + offset;
    source = source.slice(0, insertionOffset) + RLM + source.slice(insertionOffset);
  }
  return source;
}
