import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { createUiTranslator } from "@t3tools/client-runtime/i18n";
import { UiLanguageContext } from "~/i18n";
import "~/index.css";
import { render } from "../../../test/render";
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
            collapseOnResize: true,
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
  it.each(["ltr", "rtl"] as const)(
    "commits drag hiding and edge restoration only on release in %s",
    async (direction) => {
      await page.viewport(1280, 800);
      const onResize = vi.fn();
      await using screen = await render(<Harness direction={direction} onResize={onResize} />, {
        router: false /* no routes involved */,
      });
      const sidebar = screen.container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
      const wrapper = sidebar.closest<HTMLElement>('[data-slot="sidebar-wrapper"]')!;
      wrapper.dataset.panelAnimations = "true";
      wrapper.style.setProperty("--panel-animation-duration", "1s");
      const container = sidebar.querySelector<HTMLElement>('[data-slot="sidebar-container"]')!;
      const rail = sidebar.querySelector<HTMLElement>('[data-sidebar="rail"]')!;
      const pointer = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        pointerType: "mouse",
      };
      const rtl = direction === "rtl";
      const viewportWidth = window.innerWidth;
      const toPhysicalX = (x: number) => (rtl ? viewportWidth - x : x);
      const inlineStart = (element: Element) => {
        const bounds = element.getBoundingClientRect();
        return rtl ? viewportWidth - bounds.right : bounds.left;
      };
      const inlineEnd = (element: Element) => {
        const bounds = element.getBoundingClientRect();
        return rtl ? viewportWidth - bounds.left : bounds.right;
      };
      const dispatch = (target: HTMLElement, type: string, clientX: number) =>
        target.dispatchEvent(new PointerEvent(type, { ...pointer, clientX: toPhysicalX(clientX) }));
      dispatch(rail, "pointerdown", 255);
      dispatch(rail, "pointermove", 50);
      await vi.waitFor(() =>
        expect(
          sidebar.querySelector('[data-slot="sidebar-container"]')!.getBoundingClientRect().width,
        ).toBe(200),
      );
      expect(inlineStart(container)).toBe(0);
      dispatch(rail, "pointermove", 48);
      await vi.waitFor(() => expect(inlineEnd(container)).toBe(0));
      expect(sidebar.dataset.state).toBe("expanded");
      expect(onResize).not.toHaveBeenCalled();
      dispatch(rail, "pointermove", 280);
      await vi.waitFor(() => expect(inlineStart(container)).toBe(0));
      dispatch(rail, "pointerup", 280);
      expect(onResize).toHaveBeenLastCalledWith(281);
      expect(sidebar.dataset.state).toBe("expanded");
      dispatch(rail, "pointerdown", 280);
      dispatch(rail, "pointermove", 0);
      await vi.waitFor(() => expect(inlineEnd(container)).toBe(0));
      dispatch(rail, "pointerup", 0);
      await vi.waitFor(() => expect(sidebar.dataset.state).toBe("collapsed"));
      expect(inlineEnd(container)).toBe(0);
      expect(onResize).toHaveBeenLastCalledWith(200);
      expect(sidebar.inert).toBe(true);
      const handle = screen.container.querySelector<HTMLElement>(
        '[data-slot="sidebar-restore-handle"]',
      )!;
      const edge = screen.container.querySelector<HTMLElement>(
        '[data-slot="sidebar-restore-edge"]',
      )!;
      await userEvent.hover(edge);
      const bounds = edge.getBoundingClientRect();
      const startX = inlineEnd(edge) - 1;
      const endX = startX + 258;
      const y = bounds.top + bounds.height / 2;
      expect(handle.contains(document.elementFromPoint(toPhysicalX(startX), y))).toBe(true);
      expect(edge.contains(document.elementFromPoint(toPhysicalX(2), y))).toBe(false);
      dispatch(handle, "pointerdown", startX);
      dispatch(handle, "pointermove", endX);
      await vi.waitFor(() =>
        expect(
          sidebar.querySelector('[data-slot="sidebar-gap"]')!.getBoundingClientRect().width,
        ).toBe(258),
      );
      expect(sidebar.dataset.state).toBe("collapsed");
      expect(inlineStart(container)).toBe(0);
      dispatch(handle, "pointermove", startX);
      await vi.waitFor(() => expect(inlineEnd(container)).toBe(0));
      expect(
        sidebar.querySelector('[data-slot="sidebar-gap"]')!.getBoundingClientRect().width,
      ).toBe(0);
      dispatch(handle, "pointerup", startX);
      expect(sidebar.dataset.state).toBe("collapsed");
      expect(onResize).toHaveBeenCalledTimes(2);
      dispatch(handle, "pointerdown", startX);
      dispatch(handle, "pointermove", endX);
      await vi.waitFor(() => expect(inlineStart(container)).toBe(0));
      dispatch(handle, "pointerup", endX);
      await vi.waitFor(() => expect(sidebar.dataset.state).toBe("expanded"));
      expect(inlineStart(container)).toBe(0);
      expect(onResize).toHaveBeenLastCalledWith(258);
      expect(sidebar.inert).toBe(false);
    },
  );

  it.each(["pointercancel", "lostpointercapture", "blur"])(
    "abandons hide intent on %s",
    async (eventType) => {
      await page.viewport(1280, 800);
      const onResize = vi.fn();
      await using screen = await render(<Harness onResize={onResize} />, {
        router: false /* no routes involved */,
      });
      const rail = screen.container.querySelector<HTMLElement>('[data-sidebar="rail"]')!;
      const sidebar = screen.container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
      const pointer = {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        pointerType: "mouse",
        clientX: 255,
      };
      rail.dispatchEvent(new PointerEvent("pointerdown", pointer));
      rail.dispatchEvent(new PointerEvent("pointermove", { ...pointer, clientX: 0 }));
      await vi.waitFor(() =>
        expect(
          sidebar.querySelector('[data-slot="sidebar-container"]')!.getBoundingClientRect().right,
        ).toBe(0),
      );
      if (eventType === "blur") window.dispatchEvent(new Event("blur"));
      else rail.dispatchEvent(new PointerEvent(eventType, { ...pointer, clientX: 0 }));
      rail.dispatchEvent(new PointerEvent("pointerup", { ...pointer, clientX: 0 }));
      expect(sidebar.dataset.state).toBe("expanded");
      expect(onResize).not.toHaveBeenCalled();
      expect(
        sidebar.querySelector('[data-slot="sidebar-container"]')!.getBoundingClientRect().left,
      ).toBe(0);
    },
  );
});

it("restores collapsed and expanded desktop state after remounting", async () => {
  await page.viewport(1280, 800);
  const storageKey = "sidebar_persistence_test";
  localStorage.removeItem(storageKey);
  const layout = () => (
    <SidebarProvider storageKey={storageKey}>
      <SidebarTrigger />
    </SidebarProvider>
  );
  {
    await using screen = await render(layout(), { router: false /* no routes involved */ });
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    await expect.element(trigger).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(trigger);
    await expect.element(trigger).toHaveAttribute("aria-pressed", "false");
  }
  {
    await using screen = await render(layout(), { router: false /* no routes involved */ });
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    await expect.element(trigger).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(trigger);
  }
  await using screen = await render(layout(), { router: false /* no routes involved */ });
  await expect
    .element(screen.getByRole("button", { name: "Toggle Sidebar" }))
    .toHaveAttribute("aria-pressed", "true");
  localStorage.removeItem(storageKey);
});

it("keeps the mobile sheet closed and leaves the saved desktop state alone", async () => {
  await page.viewport(390, 844);
  const storageKey = "sidebar_mobile_persistence_test";
  localStorage.setItem(storageKey, "false");
  {
    await using screen = await render(
      <SidebarProvider storageKey={storageKey}>
        <SidebarTrigger />
      </SidebarProvider>,
      { router: false /* no routes involved */ },
    );
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    await expect.element(trigger).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(trigger);
    await expect.element(trigger).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(storageKey)).toBe("false");
  }
  await using screen = await render(
    <SidebarProvider storageKey={storageKey}>
      <SidebarTrigger />
    </SidebarProvider>,
    { router: false /* no routes involved */ },
  );
  await expect
    .element(screen.getByRole("button", { name: "Toggle Sidebar" }))
    .toHaveAttribute("aria-pressed", "false");
  localStorage.removeItem(storageKey);
});

function MobileSheetMountedProbe() {
  const { mobileSheetMounted } = useSidebar();
  return <output aria-label="Sheet mounted">{String(mobileSheetMounted)}</output>;
}

it("keeps closed mobile sheet contents mounted and reports the sheet only while it shows", async () => {
  await page.viewport(390, 844);
  await using screen = await render(
    <SidebarProvider>
      <Sidebar>
        <span>Sheet contents</span>
      </Sidebar>
      <SidebarTrigger />
      <MobileSheetMountedProbe />
    </SidebarProvider>,
    { router: false /* no routes involved */ },
  );
  const sheetMounted = screen.getByLabelText("Sheet mounted");
  // Window shortcuts registered by sidebar children only work while they stay mounted.
  expect(document.querySelector('[data-mobile="true"]')?.textContent).toContain("Sheet contents");
  await expect.element(sheetMounted).toHaveTextContent("false");

  await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  await expect.element(sheetMounted).toHaveTextContent("true");

  await userEvent.keyboard("{Escape}");
  await expect.element(sheetMounted).toHaveTextContent("false");
  expect(document.querySelector('[data-mobile="true"]')?.textContent).toContain("Sheet contents");
});

it("opens the mobile sheet without a transition while panel animations are off", async () => {
  await page.viewport(390, 844);
  await using screen = await render(
    <div data-panel-animations="false">
      <SidebarProvider>
        <Sidebar>
          <span>Sheet contents</span>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    </div>,
    { router: false /* no routes involved */ },
  );
  await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
  const popup = document.querySelector<HTMLElement>('[data-mobile="true"][data-sidebar="sidebar"]');
  expect(popup).not.toBeNull();
  expect(getComputedStyle(popup!).transitionDuration).toBe("0s");
});
