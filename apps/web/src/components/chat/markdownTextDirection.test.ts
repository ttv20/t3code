import { describe, expect, it } from "vite-plus/test";

import { rehypeTextDirection } from "./markdownTextDirection";

const text = (value: string) => ({ type: "text", value });
const element = (tagName: string, children: object[]) => ({
  type: "element",
  tagName,
  properties: {} as Record<string, unknown>,
  children,
});

function directed(...blocks: ReturnType<typeof element>[]) {
  rehypeTextDirection()({ type: "root", children: blocks });
  return blocks;
}

describe("rehypeTextDirection", () => {
  it("keeps raw HTML list items apart when counting words", () => {
    const [list] = directed(
      element("ul", [element("li", [text("مرحبا")]), element("li", [text("hello world today")])]),
    );
    expect(list!.properties.dir).toBe("ltr");
  });

  it("leaves inline code out of the count and isolates it", () => {
    const code = element("code", [text("useEffect useLayoutEffect React")]);
    const [paragraph] = directed(element("p", [text("استخدم "), code, text(" هنا")]));
    expect(paragraph!.properties.dir).toBe("rtl");
    expect(code.properties.dir).toBe("ltr");
  });

  it("leaves code blocks to their own left-to-right frame", () => {
    const code = element("code", [text("// احسب المجموع هنا")]);
    const [pre] = directed(element("pre", [code]));
    expect(pre!.properties.dir).toBeUndefined();
    expect(code.properties.dir).toBeUndefined();
  });

  it("directions each block independently using 30 percent of prose words", () => {
    const code = element("code", [text("one two three four five six seven eight nine ten")]);
    const [english, mixed, quote, table] = directed(
      element("p", [text("English prose remains left to right")]),
      element("p", [text("one two three four five six seven א ב ג "), code]),
      element("blockquote", [element("p", [text("Device hub: מאפשר לנהל מכשירים מכל מקום.")])]),
      element("table", [element("tr", [element("td", [text("קוד English")])])]),
    );
    expect(english!.properties.dir).toBe("ltr");
    expect(mixed!.properties.dir).toBe("rtl");
    expect(quote!.properties.dir).toBe("rtl");
    expect(table!.properties.dir).toBe("rtl");
    expect(code.properties.dir).toBe("ltr");
  });
});
