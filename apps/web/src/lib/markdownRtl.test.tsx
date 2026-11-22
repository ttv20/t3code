import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vite-plus/test";
import { wordsHast } from "../markdown/wordsHast";

const render = (source: string, breaks = false) =>
  toHtml(
    wordsHast(source, {
      math: false,
      breaks,
      escapeHtml: false,
      insights: false,
      extensions: {},
    }),
  );

describe("rendered RTL sentence boundaries", () => {
  it.each(["aaaaaaa. bbbbbb אבגדהו", "שלום aaaaaaaaaaaaaaaaaaaa. and"])(
    "corrects boundaries for the 30 percent and RTL-start rules: %s",
    (source) => {
      const html = render(source);
      expect(html).toContain(". \u200f");
      expect(source).not.toContain("\u200f");
    },
  );
  it.each([false, true])(
    "separates sentences through the chat Markdown pipeline with breaks %s",
    (breaks) => {
      const source =
        "לדוגמה משפט אחת **ending**. [and](https://example.com/next) השני מתחיל\n\n" +
        "לדוגמה משפט אחת 123: 456 השני מתחיל\n\n" +
        "`לדוגמה משפט אחת ending. and השני מתחיל`\n\n" +
        "An English sentence ending. and another starts here.";
      const html = render(source, breaks);
      expect(html).toContain(
        '<strong>ending</strong>. <a href="https://example.com/next">\u200fand</a>',
      );
      expect(html).toContain("123: \u200f456");
      expect(html).toMatch(/<code[^>]*>לדוגמה משפט אחת ending\. and השני מתחיל<\/code>/);
      expect(html).toContain("An English sentence ending. and another starts here.");
    },
  );

  it("keeps marks stable when a streamed answer grows", () => {
    const source = "לדוגמה משפט אחת ending. and השני מתחיל\n\n```ts\nconst a = 1;\n```\n\n";
    expect(render(source)).toContain("ending. \u200fand");
    const html = render(`${source}לדוגמה משפט אחת 123: 456 השני מתחיל`);
    expect(html).toContain("ending. \u200fand");
    expect(html).toContain("123: \u200f456");
    expect(html).not.toContain("\u200f\u200f");
  });
});
