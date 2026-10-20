import { act, createRef, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { ComposerPromptEditor, type ComposerPromptEditorHandle } from "../ComposerPromptEditor";
import { observeResize } from "../../lib/observeResize";
import { ComposerPromptRow } from "./ComposerPromptRow";
import "~/index.css";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function Composer({
  direction,
  width,
  value = "",
  compact = false,
}: {
  direction: "ltr" | "rtl";
  width: number;
  value?: string;
  compact?: boolean;
}) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const [actionsWidth, setActionsWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!actions) return;
    const measure = () => setActionsWidth(actions.offsetWidth);
    measure();
    return observeResize(actions, measure);
  }, [actions]);
  return (
    <div dir={direction} style={{ position: "relative", width }}>
      <ComposerPromptRow resting actionsWidth={actionsWidth}>
        <ComposerPromptEditor
          editorRef={createRef<ComposerPromptEditorHandle>()}
          value={value}
          cursor={0}
          contextRecords={new Map()}
          skills={[]}
          disabled={false}
          placeholder="אפשר לשאול שאלה, לצרף קבצים או תיקיות, לבחור סקילים או לפתוח פקודות"
          containerClassName="min-w-0 flex-1"
          className="my-0 max-h-8 min-h-8 overflow-hidden py-0 whitespace-pre! leading-8"
          placeholderClassName="flex items-center overflow-hidden whitespace-nowrap leading-8"
          onChange={() => {}}
          onPaste={() => {}}
        />
      </ComposerPromptRow>
      <div
        ref={setActions}
        data-testid="actions"
        className="absolute bottom-0 right-0 flex items-center gap-2"
      >
        {compact ? <button style={{ width: 120, height: 32 }}>Compact 456k</button> : null}
        <button style={{ width: 40, height: 32 }}>Send</button>
      </div>
    </div>
  );
}

const nextFrame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

function expectClearance(direction: "ltr" | "rtl", selector: string) {
  const prompt = container.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
  const actions = container
    .querySelector<HTMLElement>('[data-testid="actions"]')!
    .getBoundingClientRect();
  expect(prompt.width).toBeGreaterThan(50);
  if (direction === "rtl") expect(prompt.left - actions.right).toBeGreaterThanOrEqual(8);
  else expect(actions.left - prompt.right).toBeGreaterThanOrEqual(8);
}

it.each(["ltr", "rtl"] as const)(
  "keeps the collapsed placeholder clear of growing actions in %s",
  async (direction) => {
    for (const width of [360, 700]) {
      await act(async () => root.render(<Composer direction={direction} width={width} />));
      await nextFrame();
      expectClearance(direction, ".pointer-events-none");
      await act(async () => root.render(<Composer direction={direction} width={width} compact />));
      await nextFrame();
      await nextFrame();
      expectClearance(direction, ".pointer-events-none");
    }
  },
);

it("reserves the RTL interface's action side even when the typed text is LTR", async () => {
  await act(async () =>
    root.render(<Composer direction="rtl" width={360} value="English prompt" compact />),
  );
  await nextFrame();
  expectClearance("rtl", ".tiptap");
  expect(getComputedStyle(container.querySelector(".tiptap")!).direction).toBe("ltr");
});
