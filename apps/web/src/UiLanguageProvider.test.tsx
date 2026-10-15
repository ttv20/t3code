// @vitest-environment jsdom

import { useSyncExternalStore, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createPortal } from "react-dom";
import { DEFAULT_CLIENT_SETTINGS, type ClientSettings } from "@t3tools/contracts/settings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  settings: null as ClientSettings | null,
  listeners: new Set<() => void>(),
}));

vi.mock("./hooks/useSettings", () => ({
  useClientSettings: (selector: (settings: ClientSettings) => unknown) => {
    const settings = useSyncExternalStore(
      (listener) => {
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
      () => state.settings!,
    );
    return selector(settings);
  },
}));

import { UiLanguageProvider } from "./UiLanguageProvider";
import { useUiLanguage, UiText } from "./i18n";

function PortalLabel() {
  const { t } = useUiLanguage();
  return createPortal(<span>{t("Settings")}</span>, document.body);
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.settings = DEFAULT_CLIENT_SETTINGS;
  state.listeners.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function changePreferences(patch: Partial<ClientSettings>) {
  await act(() => {
    state.settings = { ...state.settings!, ...patch };
    for (const listener of state.listeners) listener();
  });
}

describe("interface language in the document and portals", () => {
  it.each([
    ["he-IL", "he", "הגדרות", "rtl"],
    ["ar-SA", "ar", "الإعدادات", "rtl"],
    ["fa-IR", "fa", "تنظیمات", "rtl"],
    ["fr-FR", "en", "Settings", "ltr"],
  ])(
    "uses %s on first launch and preserves an explicit choice",
    async (system, locale, label, direction) => {
      vi.spyOn(navigator, "languages", "get").mockReturnValue([system]);
      await act(() =>
        root.render(
          <UiLanguageProvider>
            <PortalLabel />
          </UiLanguageProvider>,
        ),
      );
      expect(document.body.textContent).toBe(label);
      expect(document.documentElement.lang).toBe(locale);
      expect(document.documentElement.dir).toBe(direction);
      await changePreferences({ interfaceLanguage: "en" });
      expect(document.body.textContent).toBe("Settings");
      expect(document.documentElement.dir).toBe("ltr");
    },
  );
  it.each([
    ["ar", "الإعدادات"],
    ["fa", "تنظیمات"],
  ] as const)("updates %s labels in portals and restores English", async (language, label) => {
    await act(() =>
      root.render(
        <UiLanguageProvider>
          <PortalLabel />
        </UiLanguageProvider>,
      ),
    );
    await changePreferences({ interfaceLanguage: language });
    expect(document.body.textContent).toBe(label);
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe("rtl");
    await changePreferences({ interfaceLanguage: "en" });
    expect(document.body.textContent).toBe("Settings");
    expect(document.documentElement.dir).toBe("ltr");
  });
  it("switches live to Hebrew RTL, permits LTR override, and switches back to English", async () => {
    await act(() =>
      root.render(
        <UiLanguageProvider>
          <PortalLabel />
        </UiLanguageProvider>,
      ),
    );
    expect(document.body.textContent).toBe("Settings");
    expect(document.documentElement.dir).toBe("ltr");

    await changePreferences({ interfaceLanguage: "he" });
    expect(document.body.textContent).toBe("הגדרות");
    expect(document.documentElement.lang).toBe("he");
    expect(document.documentElement.dir).toBe("rtl");

    await changePreferences({ interfaceDirection: "ltr" });
    expect(document.body.textContent).toBe("הגדרות");
    expect(document.documentElement.dir).toBe("ltr");

    await changePreferences({ interfaceLanguage: "en", interfaceDirection: "auto" });
    expect(document.body.textContent).toBe("Settings");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
  });
  it("keeps inline content interactive across language changes", async () => {
    let clicks = 0;
    await act(() =>
      root.render(
        <UiLanguageProvider>
          <UiText
            message={'Delete action "{0}"?'}
            values={{ "0": <button onClick={() => clicks++}>Settings</button> }}
          />
        </UiLanguageProvider>,
      ),
    );
    expect(container.textContent).toBe('Delete action "Settings"?');
    const originalButton = container.querySelector("button");
    await changePreferences({ interfaceLanguage: "he" });
    expect(container.textContent).toContain("Settings");
    expect(container.textContent).not.toContain("Delete action");
    expect(container.querySelector("button")).toBe(originalButton);
    await act(() => container.querySelector("button")!.click());
    expect(clicks).toBe(1);
    await changePreferences({ interfaceLanguage: "fa" });
    expect(container.querySelector("button")).toBe(originalButton);
    expect(container.textContent).toContain("Settings");
    await changePreferences({ interfaceLanguage: "en" });
    expect(container.textContent).toBe('Delete action "Settings"?');
  });

  it("renders repeated inline controls and retains a missing slot", async () => {
    let clicks = 0;
    await act(() =>
      root.render(
        <UiLanguageProvider>
          <UiText
            message="{0} / {0} / {1}"
            values={{ "0": <button onClick={() => clicks++}>Run</button> }}
          />
        </UiLanguageProvider>,
      ),
    );
    expect(container.textContent).toBe("Run / Run / {1}");
    expect(container.querySelectorAll("button")).toHaveLength(2);
    await act(() => {
      for (const button of container.querySelectorAll("button")) button.click();
    });
    expect(clicks).toBe(2);
  });
});
