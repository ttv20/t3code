import { describe, expect, it } from "vite-plus/test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { remarkRtlSentenceBoundaries } from "@t3tools/client-runtime/markdown-rtl";
import {
  markdownForDisplay,
  markdownForNativeRendering,
  prepareNativeMarkdown,
  type MarkdownNode,
} from "./markdownDocument";
import { ENRICHED_INLINE_FILE_LINK_REGEX } from "./enrichedLinkPresentation";

describe("native direction before file presentation", () => {
  const prose = "alpha beta gamma delta epsilon zeta eta א ב ג";

  it("excludes inline file code at exactly 30% RTL words", () => {
    const source = `- ${prose} \`src/app.ts\``;
    expect(prepareNativeMarkdown(source, ENRICHED_INLINE_FILE_LINK_REGEX).markdown).toBe(
      `- \u200f${prose} [src/app.ts](<src/app.ts>)`,
    );
  });

  it("counts ordinary prose labels even when they link to the same file as an embed", () => {
    expect(
      prepareNativeMarkdown(
        "alpha beta gamma delta epsilon zeta eta [א ב ג](./notes.md) ![notes](./notes.md)",
        ENRICHED_INLINE_FILE_LINK_REGEX,
        () => "notes.md",
      ).markdown,
    ).toBe(
      "\u200falpha beta gamma delta epsilon zeta eta [א ב ג](./notes.md) [notes.md](<./notes.md>)",
    );
  });

  it("excludes a filename replacing a file embed at exactly 30% RTL words", () => {
    const source = `- ${prose} ![notes](./notes.md)`;
    const prepared = prepareNativeMarkdown(
      source,
      ENRICHED_INLINE_FILE_LINK_REGEX,
      () => "notes.md",
    );
    expect(prepared.markdown).toBe(`- \u200f${prose} [notes.md](<./notes.md>)`);
    expect([...prepared.fileHrefs]).toEqual(["./notes.md"]);
  });

  it("keeps a solitary image standalone without direction marks from its alt text", () => {
    const source = "![תיאור בעברית](./audio.mp3)";
    const prepared = prepareNativeMarkdown(
      source,
      ENRICHED_INLINE_FILE_LINK_REGEX,
      (_href, standalone) => (standalone ? null : "audio.mp3"),
    );
    expect(prepared.markdown).toBe(source);
    expect(prepared.fileHrefs.size).toBe(0);
  });

  it("keeps below-threshold prose LTR when an embed receives a Hebrew filename", () => {
    const prepared = prepareNativeMarkdown(
      "שלום alpha beta gamma ![notes](./notes.md)",
      ENRICHED_INLINE_FILE_LINK_REGEX,
      () => "הערות בעברית.md",
    );
    expect(prepared.markdown).toBe("\u200eשלום alpha beta gamma [הערות בעברית.md](<./notes.md>)");
  });

  it.each([
    [
      "![תיאור](./notes.md) הסבר בעברית כאן",
      "notes.md",
      "\u200f[notes.md](<./notes.md>) הסבר בעברית כאן",
    ],
    [
      "![notes](./notes.md) alpha beta gamma",
      "הערות.md",
      "\u200e[הערות.md](<./notes.md>) alpha beta gamma",
    ],
  ])(
    "resolves visible first-strong direction after a leading file embed: %s",
    (source, label, expected) => {
      expect(
        prepareNativeMarkdown(source, ENRICHED_INLINE_FILE_LINK_REGEX, () => label).markdown,
      ).toBe(expected);
    },
  );

  it("preserves file destinations, labels and fenced code while resolving direction", () => {
    const path = String.raw`C:\repo\_draft\a&copy;.ts`;
    const code = 'const label = "שלום";';
    const prepared = prepareNativeMarkdown(
      `${prose} \`${path}\` ![notes](./notes&a.md)\n\n\`\`\`ts\n${code}\n\`\`\``,
      ENRICHED_INLINE_FILE_LINK_REGEX,
      () => "notes [draft]&.md",
    );
    expect(prepared.markdown.startsWith("\u200f")).toBe(true);
    const document = processor.parse(prepared.markdown);
    const paragraph = document.children[0];
    const links =
      paragraph?.type === "paragraph"
        ? paragraph.children.filter((node) => node.type === "link")
        : [];
    expect(links.map((link) => [link.url, link.children.map(proseText).join("")])).toEqual([
      [path, path],
      ["./notes&a.md", "notes [draft]&.md"],
    ]);
    expect(document.children.find((node) => node.type === "code")?.value).toBe(code);
  });
});

it("preserves RTL sentence boundaries through native file-link normalization", () => {
  expect(
    markdownForNativeRendering("לדוגמה משפט אחת ending. and השני מתחיל עם `src/app.ts`", /^src\//),
  ).toBe("לדוגמה משפט אחת ending. \u200fand השני מתחיל עם [src/app.ts](<src/app.ts>)");
});

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

it("preserves an interrupting table while correcting RTL prose", () => {
  const source = "משפט לדוגמה בעברית ארוכה ending. next\n| a | b |\n|---|---|\n| c | d |";
  expect(markdownForDisplay(source)).toBe(
    "משפט לדוגמה בעברית ארוכה ending. \u200fnext\n\n| a | b |\n|---|---|\n| c | d |",
  );
});

describe("native paragraph directions", () => {
  it("resolves a new paragraph independently of the preceding sentence", () => {
    expect(markdownForDisplay("לדוגמה משפט אחת ending.\n\nand השני מתחיל בעברית עוד מילים")).toBe(
      "לדוגמה משפט אחת ending.\n\n\u200fand השני מתחיל בעברית עוד מילים",
    );
  });
  it.each([
    "- **Podcast Addict:** גם ללא סשן Play נגן נעוץ יכול לקבל פקודת ניגון דרך הממשק שלו.",
    "- **Spotify:** גם ללא סשן Play נוסף ניסיון חידוש מקומי בלחיצה על אישור החיבור.",
    "1. **Spotify:** נגן זה צריך להיות מיושר לימין לפי תוכן הפריט.",
    "> **Podcast Addict:** זהו תיאור בעברית שמתחיל בשם באנגלית.",
    "### **Spotify:** כותרת בעברית עם שם באנגלית",
  ])("uses the shared threshold for English-prefixed Hebrew prose: %s", (source) => {
    expect(markdownForDisplay(source)).toBe(source.replace("**", "\u200f**"));
    expect(markdownForDisplay(markdownForDisplay(source))).toBe(markdownForDisplay(source));
  });

  it("resolves adjacent list items independently and excludes code and destinations", () => {
    const source =
      "- **Spotify:** נגן זה מקבל פקודות ניגון באופן מקומי.\n- English instructions for the player.\n- [Spotify](https://example.com/a-very-long-english-destination): הפעלת נגן מקומי.\n- `veryLongEnglishCodeIdentifier`: הסבר בעברית על הפעלת הנגן.";
    expect(markdownForDisplay(source)).toBe(
      "- \u200f**Spotify:** נגן זה מקבל פקודות ניגון באופן מקומי.\n- English instructions for the player.\n- \u200f[Spotify](https://example.com/a-very-long-english-destination): הפעלת נגן מקומי.\n- \u200f`veryLongEnglishCodeIdentifier`: הסבר בעברית על הפעלת הנגן.",
    );
  });

  it("keeps predominantly English prose LTR even when it starts in Hebrew", () => {
    expect(
      markdownForDisplay(
        "שלום this paragraph contains predominantly English instructions for the player.",
      ),
    ).toBe("\u200eשלום this paragraph contains predominantly English instructions for the player.");
  });
});

it("uses the web word threshold independently of word length", () => {
  expect(
    markdownForDisplay("- extraordinarilyLongEnglishIdentifier one two three four five six א ב ג"),
  ).toBe("- \u200fextraordinarilyLongEnglishIdentifier one two three four five six א ב ג");
  const english =
    "- one two three four five six seven eight אבגדהוזחטיכלמנסעפצקרשת אבגדהוזחטיכלמנסעפצקרשת";
  expect(markdownForDisplay(english)).toBe(english);
});
