import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import { FileExplorerPane } from "./FileExplorerPane";
import { UiLanguageContext } from "~/i18n";
import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import "~/index.css";

const STORAGE_KEY = "test:file-explorer-default";

describe("FileExplorerPane", () => {
  it.each(["ltr", "rtl"] as const)(
    "follows pointer and keyboard movement in %s",
    async (direction) => {
      const key = `${STORAGE_KEY}:direction:${direction}`;
      const previous = localStorage.getItem(key);
      localStorage.removeItem(key);
      try {
        // File-pane resizing has no navigation.
        await using screen = await render(
          <UiLanguageContext value={{ locale: "en", direction, t: createUiTranslator("en") }}>
            <div dir={direction} style={{ display: "flex", width: 900 }}>
              <div style={{ flex: 1 }}>File content</div>
              <FileExplorerPane resizable storageKey={key}>
                File tree
              </FileExplorerPane>
            </div>
          </UiLanguageContext>,
          { router: false },
        );
        const handle = screen.container.querySelector<HTMLElement>('[role="separator"]')!;
        const panel = screen.container.querySelector("aside")!;
        const initialWidth = panel.getBoundingClientRect().width;
        const initialX = handle.getBoundingClientRect().left;
        const widthSign = direction === "rtl" ? 1 : -1;
        using _capture = vi.spyOn(handle, "setPointerCapture").mockImplementation(() => {});
        const pointer = { bubbles: true, pointerId: 1, button: 0 };
        for (const delta of [40, -40]) {
          const from = handle.getBoundingClientRect().left;
          const beforeWidth = panel.getBoundingClientRect().width;
          handle.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: from }));
          handle.dispatchEvent(
            new PointerEvent("pointerup", { ...pointer, clientX: from + delta }),
          );
          await vi.waitFor(() =>
            expect(panel.getBoundingClientRect().width).toBe(beforeWidth + delta * widthSign),
          );
          expect(handle.getBoundingClientRect().left).toBeCloseTo(from + delta);
          expect(localStorage.getItem(key)).toBe(String(beforeWidth + delta * widthSign));
        }
        for (const [arrow, delta] of [
          ["ArrowRight", 16],
          ["ArrowLeft", -16],
        ] as const) {
          const from = handle.getBoundingClientRect().left;
          const beforeWidth = panel.getBoundingClientRect().width;
          handle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: arrow }));
          await vi.waitFor(() =>
            expect(panel.getBoundingClientRect().width).toBe(beforeWidth + delta * widthSign),
          );
          expect(handle.getBoundingClientRect().left).toBeCloseTo(from + delta);
        }
        expect(panel.getBoundingClientRect().width).toBe(initialWidth);
        expect(handle.getBoundingClientRect().left).toBeCloseTo(initialX);
      } finally {
        if (previous === null) localStorage.removeItem(key);
        else localStorage.setItem(key, previous);
      }
    },
  );

  it.each([
    { view: "Changes", defaultWidth: 256, defaultWidthFraction: 0.4, minWidth: 160, expected: 168 },
    { view: "PR Code", defaultWidth: 320, defaultWidthFraction: 0.4, minWidth: 192, expected: 192 },
    {
      view: "Files",
      defaultWidth: 256,
      minWidth: 160,
      expected: 164,
    },
  ])(
    "preserves the $view initial width in a 420px row",
    async ({ expected, view: _, ...sizing }) => {
      const previous = localStorage.getItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      try {
        // This layout has no navigation or links.
        await using screen = await render(
          <div style={{ display: "flex", width: 420 }}>
            <FileExplorerPane resizable storageKey={STORAGE_KEY} {...sizing}>
              File tree
            </FileExplorerPane>
          </div>,
          { router: false },
        );
        await expect
          .element(screen.getByRole("separator"))
          .toHaveAttribute("aria-valuenow", String(expected));
        expect(screen.container.querySelector("aside")!.getBoundingClientRect().width).toBe(
          expected,
        );
      } finally {
        if (previous === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previous);
      }
    },
  );
});
