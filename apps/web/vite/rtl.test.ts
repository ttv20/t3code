import postcss from "postcss";
import nesting from "postcss-nesting";
import { describe, expect, it } from "vite-plus/test";
import { directionSelector, rtlStyles } from "./rtl";

const process = async (css: string) =>
  (await postcss([nesting(), rtlStyles()]).process(css, { from: undefined })).css;

describe("generated RTL styles", () => {
  it("generates both directions for upstream physical utilities", async () => {
    const output = await process(".pl-4 { padding-left: 1rem } .right-0 { right: 0 }");
    expect(output).toContain(".pl-4:where(:dir(ltr))");
    expect(output).toContain(".pl-4:where(:dir(rtl))");
    expect(output).toContain("padding-right: 1rem");
    expect(output).toContain(".right-0:where(:dir(rtl))");
    expect(output).toContain("left: 0");
  });

  it("preserves logical utilities and their cascade specificity", async () => {
    const output = await process(
      ".ps-4 { padding-inline-start: 1rem } .left-0 { left: 0 } .left-auto { left: auto }",
    );
    expect(output).toContain(".ps-4 { padding-inline-start: 1rem }");
    expect(output).toContain(".left-auto:where(:dir(rtl))");
    expect(output).not.toContain("[dir=");
  });

  it("scopes nested selectors to the target, so an LTR code block under RTL stays LTR", async () => {
    const output = await process(".markdown { & pre::before { padding-left: 1rem } }");
    expect(output).toContain(".markdown pre:where(:dir(ltr))::before");
    expect(output).toContain(".markdown pre:where(:dir(rtl))::before");
    expect(output).not.toContain(".markdown:where(:dir(rtl)) pre");
  });

  it("keeps URLs and existing explicit direction rules intact", async () => {
    const output = await process(
      '.asset { background: url("arrow-left.svg"); margin-left: 2px } .custom:dir(rtl) { left: 4px }',
    );
    expect(output).toContain('url("arrow-left.svg")');
    expect(output).not.toContain("arrow-right.svg");
    expect(output).toContain(".custom:dir(rtl) { left: 4px }");
  });

  it("mirrors Tailwind 4 translations while preserving explicit content direction", async () => {
    const output = await process(
      ".center { left: 50%; --tw-translate-x: -50%; translate: var(--tw-translate-x) 0 } .terminal { direction: ltr }",
    );
    expect(output).toContain("right: 50%");
    expect(output).toContain("--tw-translate-x: calc((-50%) * -1)");
    expect(output).toContain(".terminal { direction: ltr }");
  });

  it("places zero-specificity direction guards before pseudo-elements", () => {
    expect(directionSelector(":dir(rtl)", ".button::before")).toBe(
      ".button:where(:dir(rtl))::before",
    );
    expect(directionSelector(":dir(ltr)", "html, :root, .button:hover")).toBe(
      "html:where(:dir(ltr)), :root:where(:dir(ltr)), .button:hover:where(:dir(ltr))",
    );
  });
});
