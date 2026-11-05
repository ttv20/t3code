import { page, userEvent } from "vite-plus/test/browser";
import { describe, expect, it, vi } from "vite-plus/test";

import { render } from "../../../test/render";
import { UiLanguageContext } from "~/i18n";
import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import "~/index.css";
import { Sidebar, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from "./sidebar";

function CollapseFromInside() {
  const { setOpen } = useSidebar();
  return (
    <button type="button" onClick={() => setOpen(false)}>
      Collapse
    </button>
  );
}

function Harness(props: {
  readonly onResize?: (width: number) => void;
  readonly direction?: "ltr" | "rtl";
  readonly side?: "left" | "right";
}) {
  const direction = props.direction ?? "ltr";
  return (
    <UiLanguageContext value={{ locale: "en", direction, t: createUiTranslator("en") }}>
      <SidebarProvider defaultOpen dir={direction}>
        <Sidebar
          side={props.side ?? "left"}
          collapsible="offcanvas"
          resizable={{
            minWidth: 200,
            maxWidth: 600,
            ...(props.onResize ? { onResize: props.onResize } : {}),
          }}
        >
          <CollapseFromInside />
          <SidebarRail />
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    </UiLanguageContext>
  );
}

describe("Sidebar", () => {
  it.each([
    { direction: "ltr", side: "left", widthSign: 1 },
    { direction: "rtl", side: "left", widthSign: -1 },
    { direction: "ltr", side: "right", widthSign: -1 },
    { direction: "rtl", side: "right", widthSign: 1 },
  ] as const)(
    "follows the pointer on the $side side in $direction",
    async ({ direction, side, widthSign }) => {
      await page.viewport(1280, 800);
      const onResize = vi.fn();
      // Sidebar dragging has no navigation.
      await using screen = await render(
        <Harness direction={direction} side={side} onResize={onResize} />,
        { router: false },
      );
      const rail = screen.container.querySelector<HTMLElement>('[data-sidebar="rail"]')!;
      const panel = screen.container.querySelector<HTMLElement>('[data-slot="sidebar-container"]')!;
      const initialWidth = panel.getBoundingClientRect().width;
      const initialX = rail.getBoundingClientRect().left;
      using _capture = vi.spyOn(rail, "setPointerCapture").mockImplementation(() => {});
      const pointer = { bubbles: true, pointerId: 1, button: 0 };
      for (const delta of [40, -40]) {
        const from = rail.getBoundingClientRect().left;
        const beforeWidth = panel.getBoundingClientRect().width;
        rail.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: from }));
        rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: from + delta }));
        await vi.waitFor(() =>
          expect(panel.getBoundingClientRect().width).toBe(beforeWidth + delta * widthSign),
        );
        expect(rail.getBoundingClientRect().left).toBeCloseTo(from + delta);
        expect(onResize).toHaveBeenLastCalledWith(beforeWidth + delta * widthSign);
      }
      expect(panel.getBoundingClientRect().width).toBe(initialWidth);
      expect(rail.getBoundingClientRect().left).toBeCloseTo(initialX);
    },
  );

  it("hands focus to the outside trigger when it collapses around the focused control", async () => {
    await page.viewport(1280, 800);
    await using screen = await render(<Harness />, { router: false /* no routes involved */ });

    await userEvent.click(screen.getByRole("button", { name: "Collapse" }));

    const sidebar = screen.container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
    await vi.waitFor(() => expect(sidebar.inert).toBe(true));
    const trigger = screen.container.querySelector('[data-slot="sidebar-trigger"]');
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("abandons a rail drag when the sidebar collapses mid-drag", async () => {
    await page.viewport(1280, 800);
    const onResize = vi.fn();
    await using screen = await render(<Harness onResize={onResize} />, {
      router: false /* no routes involved */,
    });
    const rail = screen.container.querySelector<HTMLElement>('[data-sidebar="rail"]')!;
    const { left, top } = rail.getBoundingClientRect();
    const pointer = { bubbles: true, cancelable: true, pointerId: 1, button: 0, clientY: top + 10 };
    const dragTo = (clientX: number) => {
      rail.dispatchEvent(new PointerEvent("pointerdown", { ...pointer, clientX: left }));
      rail.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX }));
    };
    // A completed drag commits, so the abandoned one below is a real drag too.
    dragTo(left + 40);
    rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: left + 40 }));
    expect(onResize).toHaveBeenCalledTimes(1);

    dragTo(left + 80);
    await userEvent.click(
      screen.container.querySelector<HTMLElement>('[data-slot="sidebar-trigger"]')!,
    );
    rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: left + 80 }));

    expect(onResize).toHaveBeenCalledTimes(1);
  });
});
