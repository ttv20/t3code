import { RegistryContext } from "@effect/atom-react";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { AtomRegistry } from "effect/reactivity";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const harness = vi.hoisted(() => ({ loads: [] as unknown[] }));
vi.mock("react-native", () => ({ Pressable: "button", View: "div" }));
vi.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
vi.mock("../../components/ui/AppSymbol", () => ({ SymbolView: () => null }));
vi.mock("../../components/ui/AppText", () => ({ AppText: "span" }));
vi.mock("../../components/ui/Dialog", () => ({ alert: vi.fn() }));
vi.mock("../../i18n", () => ({ useUiLanguage: () => ({ t: (s: string) => s, locale: "en" }) }));
vi.mock("../usage/UsageLimitsSection", () => ({
  useRefreshLimits: () => ({ refreshing: false, refresh: vi.fn() }),
}));
vi.mock("./use-visible-second-clock", () => ({ useVisibleSecondClock: () => 0 }));
vi.mock("../../state/threads", async () => {
  const { Atom } = await import("effect/reactivity");
  return {
    environmentThreadDetails: {
      quietThreadAtom: Atom.family((ref: unknown) =>
        Atom.make(() => {
          harness.loads.push(ref);
          return null;
        }),
      ),
    },
  };
});

import { ComposerStatus } from "./ComposerStatus";

it("does not load a draft or queued creation before its delivered detail ref exists", () => {
  harness.loads = [];
  const registry = AtomRegistry.make();
  const root = createRoot(document.createElement("div"));
  const environmentId = EnvironmentId.make("environment");
  const threadId = ThreadId.make("future-thread");
  const props = {
    environmentId,
    provider: null,
    connected: true,
    hidden: false,
    onShowUsageLimits: () => {},
  };
  try {
    act(() =>
      root.render(
        <RegistryContext value={registry}>
          <ComposerStatus {...props} threadRef={null} />
        </RegistryContext>,
      ),
    );
    expect(harness.loads).toEqual([]);
    const threadRef = { environmentId, threadId };
    act(() =>
      root.render(
        <RegistryContext value={registry}>
          <ComposerStatus {...props} threadRef={threadRef} />
        </RegistryContext>,
      ),
    );
    expect(harness.loads).toEqual([threadRef]);
  } finally {
    act(() => root.unmount());
    registry.dispose();
  }
});
