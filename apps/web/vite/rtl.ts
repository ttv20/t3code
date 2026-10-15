import postcssRTLCSS from "postcss-rtlcss";
import selectorParser from "postcss-selector-parser";

/**
 * Scope each generated rule to the direction of its actual element. An ancestor
 * [dir=rtl] prefix would also match code/terminals nested under dir=ltr.
 * :where keeps Tailwind's cascade and responsive overrides at their original specificity.
 */
// A read-only view avoids the parser's recursive mutation types, which tsc-rs
// cannot instantiate. Selector tokenization still belongs to the parser.
interface DirectionSelectorNode {
  type: string;
  value: string;
  toString(): string;
}

export function directionSelector(prefix: string, source: string) {
  const parsed = selectorParser().astSync(source) as unknown as {
    nodes: { nodes: DirectionSelectorNode[] }[];
  };
  return parsed.nodes
    .map((selector) => {
      const index = selector.nodes.findIndex(
        (node) =>
          node.type === "pseudo" &&
          (node.value.startsWith("::") ||
            [":before", ":after", ":first-letter", ":first-line"].includes(node.value)),
      );
      const position = index < 0 ? selector.nodes.length : index;
      const before = selector.nodes.slice(0, position).join("");
      const after = selector.nodes.slice(position).join("");
      return `${before}:where(${prefix})${after}`;
    })
    .join(",");
}

/** Runs after Tailwind, in dev and builds. New upstream physical utilities get RTL automatically. */
export function rtlStyles() {
  return postcssRTLCSS({
    mode: "combined",
    runOnExit: true,
    ltrPrefix: ":dir(ltr)",
    rtlPrefix: ":dir(rtl)",
    bothPrefix: ":dir(ltr), :dir(rtl)",
    prefixSelectorTransformer: directionSelector,
    processUrls: false,
    processKeyFrames: false,
    processDeclarationPlugins: [
      {
        name: "tailwind-direction",
        priority: 99,
        processors: [
          // Explicit directions protect terminals and code from the surrounding UI.
          { expr: /^direction$/, action: (prop, value) => ({ prop, value }) },
          // Tailwind 4 uses a custom property for horizontal translation.
          {
            expr: /^--tw-translate-x$/,
            action: (prop, value) => ({ prop, value: `calc((${value}) * -1)` }),
          },
        ],
      },
    ],
  });
}
