import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import { createMemoryHistory } from "@tanstack/react-router";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { AppRoot } from "~/AppRoot";
import "./ChatView";
import "~/index.css";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { writeLocalStorageValue } from "~/hooks/useLocalStorage";
import * as Schema from "effect/Schema";
import { getRouter } from "~/router";
import {
  installFakeEnvironment,
  threadWithHistory,
  runningRun,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { render, act } from "../../test/render";

vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});
vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

it("collapses the selected working thread only when the shelf is docked", async () => {
  await page.viewport(1400, 900);
  const thread = threadWithHistory("working-selected", 1);
  using _environment = installFakeEnvironment([
    { ...thread, runs: [runningRun(thread.id, `${thread.id}-run-0`, 1, `${thread.id}-user-0`)] },
  ]);
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    sidebarWorkingShelfEnabled: true,
  });
  localStorage.setItem("t3code:sticky-working-shelf:v1", "true");
  localStorage.setItem("t3code:sidebar:working-expanded", "true");
  const router = getRouter(
    createMemoryHistory({ initialEntries: ["/environment-render/working-selected"] }),
  );
  await router.load();
  const container = document.createElement("div");
  container.style.cssText = "height:100dvh;width:100vw";
  await using screen = await render(<AppRoot router={router} />, {
    container,
    router: false /* AppRoot owns its router. */,
  });
  const shelf = page.getByTestId("sticky-working-shelf");
  const header = page.getByTestId("sidebar-working-shelf-toggle");
  await expect.element(shelf).toBeInTheDocument();
  await expect.element(shelf.getByText(thread.title, { exact: true }).last()).toBeVisible();
  await header.click();
  await expect.element(header).toHaveAttribute("aria-expanded", "false");
  expect(
    shelf.element().querySelectorAll('[data-sidebar-parent="shelf:working"][data-sidebar-row]'),
  ).toHaveLength(0);
  await act(() =>
    writeLocalStorageValue("t3code:sticky-working-shelf:v1", false, false, Schema.Boolean),
  );
  await expect.element(shelf).not.toBeInTheDocument();
  const routeRow = screen.container.querySelector(
    '[data-sidebar-parent="shelf:working"][data-sidebar-row]',
  );
  expect(routeRow).not.toBeNull();
  await act(() =>
    writeLocalStorageValue("t3code:sticky-working-shelf:v1", true, false, Schema.Boolean),
  );
  await expect.element(shelf).toBeInTheDocument();
  expect(
    shelf.element().querySelectorAll('[data-sidebar-parent="shelf:working"][data-sidebar-row]'),
  ).toHaveLength(0);
  await header.click();
  await expect.element(header).toHaveAttribute("aria-expanded", "true");
  expect(
    shelf.element().querySelectorAll('[data-sidebar-parent="shelf:working"][data-sidebar-row]'),
  ).toHaveLength(1);
});
