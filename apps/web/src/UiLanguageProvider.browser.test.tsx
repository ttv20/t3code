import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_CLIENT_SETTINGS, type ClientSettings } from "@t3tools/contracts/settings";
import { describe, expect, it, vi } from "vite-plus/test";
import { act, render } from "../test/render";

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
  return createPortal(<span data-testid="portal-label">{t("Settings")}</span>, document.body);
}

function setup(patch: Partial<ClientSettings> = {}): Disposable {
  const { lang, dir } = document.documentElement;
  state.settings = { ...DEFAULT_CLIENT_SETTINGS, interfaceLanguage: "en", ...patch };
  state.listeners.clear();
  return {
    [Symbol.dispose]() {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    },
  };
}

async function changePreferences(patch: Partial<ClientSettings>) {
  await act(() => {
    state.settings = { ...state.settings!, ...patch };
    for (const listener of state.listeners) listener();
  });
}
const portalText = () => document.querySelector('[data-testid="portal-label"]')?.textContent;

describe("interface language in the document and portals", () => {
  it.each([
    ["he-IL", "he", "הגדרות", "rtl"],
    ["ar-SA", "ar", "الإعدادات", "rtl"],
    ["fa-IR", "fa", "تنظیمات", "rtl"],
    ["fr-FR", "en", "Settings", "ltr"],
  ])(
    "uses %s on first launch and preserves an explicit choice",
    async (system, locale, label, direction) => {
      using _preferences = setup({ interfaceLanguage: "system" });
      using _languages = vi.spyOn(navigator, "languages", "get").mockReturnValue([system]);
      // The language fixture has no navigation.
      await using _screen = await render(
        <UiLanguageProvider>
          <PortalLabel />
        </UiLanguageProvider>,
        { router: false },
      );
      expect(portalText()).toBe(label);
      expect(document.documentElement.lang).toBe(locale);
      expect(document.documentElement.dir).toBe(direction);
      await changePreferences({ interfaceLanguage: "en" });
      expect(portalText()).toBe("Settings");
      expect(document.documentElement.dir).toBe("ltr");
    },
  );

  it.each([
    ["ar", "الإعدادات"],
    ["fa", "تنظیمات"],
  ] as const)("updates %s labels in portals and restores English", async (language, label) => {
    using _preferences = setup();
    // The language fixture has no navigation.
    await using _screen = await render(
      <UiLanguageProvider>
        <PortalLabel />
      </UiLanguageProvider>,
      { router: false },
    );
    await changePreferences({ interfaceLanguage: language });
    expect(portalText()).toBe(label);
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe("rtl");
    await changePreferences({ interfaceLanguage: "en" });
    expect(portalText()).toBe("Settings");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("switches live to Hebrew RTL, permits LTR override, and switches back to English", async () => {
    using _preferences = setup();
    // The language fixture has no navigation.
    await using _screen = await render(
      <UiLanguageProvider>
        <PortalLabel />
      </UiLanguageProvider>,
      { router: false },
    );
    await changePreferences({ interfaceLanguage: "he" });
    expect(portalText()).toBe("הגדרות");
    expect(document.documentElement.lang).toBe("he");
    expect(document.documentElement.dir).toBe("rtl");
    await changePreferences({ interfaceDirection: "ltr" });
    expect(portalText()).toBe("הגדרות");
    expect(document.documentElement.dir).toBe("ltr");
    await changePreferences({ interfaceLanguage: "en", interfaceDirection: "auto" });
    expect(portalText()).toBe("Settings");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("keeps inline content interactive and preserves user names across language changes", async () => {
    using _preferences = setup();
    let clicks = 0;
    // Inline translation and portals do not need a router.
    await using screen = await render(
      <UiLanguageProvider>
        <UiText
          message={'Delete action "{0}"?'}
          values={{ "0": <button onClick={() => clicks++}>Settings</button> }}
        />
      </UiLanguageProvider>,
      { router: false },
    );
    expect(screen.container.textContent).toBe('Delete action "Settings"?');
    const originalButton = screen.container.querySelector("button");
    await changePreferences({ interfaceLanguage: "he" });
    expect(screen.container.textContent).toContain("Settings");
    expect(screen.container.textContent).not.toContain("Delete action");
    expect(screen.container.querySelector("button")).toBe(originalButton);
    await act(() => originalButton!.click());
    expect(clicks).toBe(1);
    await changePreferences({ interfaceLanguage: "fa" });
    expect(screen.container.querySelector("button")).toBe(originalButton);
    await changePreferences({ interfaceLanguage: "en" });
    expect(screen.container.textContent).toBe('Delete action "Settings"?');
  });

  it("renders repeated inline controls and retains a missing slot", async () => {
    using _preferences = setup();
    let clicks = 0;
    // Inline translation and portals do not need a router.
    await using screen = await render(
      <UiLanguageProvider>
        <UiText
          message="{0} / {0} / {1}"
          values={{ "0": <button onClick={() => clicks++}>Run</button> }}
        />
      </UiLanguageProvider>,
      { router: false },
    );
    expect(screen.container.textContent).toBe("Run / Run / {1}");
    await act(() => {
      for (const button of screen.container.querySelectorAll("button")) button.click();
    });
    expect(clicks).toBe(2);
  });
});
