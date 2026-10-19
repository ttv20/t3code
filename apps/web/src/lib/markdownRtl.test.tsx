import { describe, expect, it } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import {
  CHAT_MARKDOWN_REHYPE_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS,
  CHAT_MARKDOWN_REMARK_PLUGINS_WITH_BREAKS,
} from "@t3tools/shared/markdownPipeline";
import { remarkRtlSentenceBoundaries } from "@t3tools/client-runtime/markdown-rtl";
import { createIncrementalMarkdownPlugin } from "../markdown-incremental";

describe("rendered RTL sentence boundaries", () => {
  it.each(["aaaaaaa. bbbbbb אבגדהו", "שלום aaaaaaaaaaaaaaaaaaaa. and"])(
    "corrects boundaries for the 30 percent and RTL-start rules: %s",
    (source) => {
      const html = renderToStaticMarkup(
        <ReactMarkdown
          remarkPlugins={[...CHAT_MARKDOWN_REMARK_PLUGINS, remarkRtlSentenceBoundaries]}
        >
          {source}
        </ReactMarkdown>,
      );
      expect(html).toContain(". \u200f");
      expect(source).not.toContain("\u200f");
    },
  );
  it.each([
    { plugins: CHAT_MARKDOWN_REMARK_PLUGINS },
    { plugins: CHAT_MARKDOWN_REMARK_PLUGINS_WITH_BREAKS },
  ])("separates sentences through the chat Markdown pipeline", ({ plugins }) => {
    const source =
      "לדוגמה משפט אחת **ending**. [and](https://example.com/next) השני מתחיל\n\n" +
      "לדוגמה משפט אחת 123: 456 השני מתחיל\n\n" +
      "`לדוגמה משפט אחת ending. and השני מתחיל`\n\n" +
      "An English sentence ending. and another starts here.";
    const html = renderToStaticMarkup(
      <ReactMarkdown
        remarkPlugins={[...plugins, remarkRtlSentenceBoundaries]}
        rehypePlugins={CHAT_MARKDOWN_REHYPE_PLUGINS}
      >
        {source}
      </ReactMarkdown>,
    );
    expect(html).toContain(
      '<strong>ending</strong>. <a href="https://example.com/next">\u200fand</a>',
    );
    expect(html).toContain("123: \u200f456");
    expect(html).toMatch(/<code[^>]*>לדוגמה משפט אחת ending\. and השני מתחיל<\/code>/);
    expect(html).toContain("An English sentence ending. and another starts here.");
  });

  it("keeps marks stable when a cached prefix is reused during streaming", () => {
    const incremental = createIncrementalMarkdownPlugin();
    const render = (source: string) =>
      renderToStaticMarkup(
        <ReactMarkdown
          remarkPlugins={[
            ...CHAT_MARKDOWN_REMARK_PLUGINS,
            incremental,
            remarkRtlSentenceBoundaries,
          ]}
        >
          {source}
        </ReactMarkdown>,
      );
    const source = "לדוגמה משפט אחת ending. and השני מתחיל\n\n```ts\nconst a = 1;\n```\n\n";
    expect(render(source)).toContain("ending. \u200fand");
    const html = render(`${source}לדוגמה משפט אחת 123: 456 השני מתחיל`);
    expect(html).toContain("ending. \u200fand");
    expect(html).toContain("123: \u200f456");
    expect(html).not.toContain("\u200f\u200f");
  });
});
