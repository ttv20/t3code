import { createUiTranslator, type UiLocale } from "@t3tools/client-runtime/i18n";
import { getReactI18nCache } from "@generaltranslation/react-core/pure";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

// This test initializes the real locale catalogs instead of the other tests' English-only GT shim.
vi.mock("gt-react-native", async () => {
  const pure = await import("@generaltranslation/react-core/pure");
  const components = await import("@generaltranslation/react-core/components");
  const hooks = await import("@generaltranslation/react-core/hooks");
  return { ...pure, ...components, ...hooks };
});

const nativeStore = vi.hoisted(() => new Map<string, string>());
const nativeWrites = vi.hoisted(() => [] as Array<() => void>);
const language = vi.hoisted(() => ({ value: "en" as UiLocale }));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  I18nManager: { getConstants: () => ({ localeIdentifier: "en-US" }) },
  TurboModuleRegistry: {
    getEnforcing: () => ({
      getNativeLocales: () => ["en-US"],
      nativeStoreGet: (key: string) => nativeStore.get(key) ?? null,
      // TurboModule void methods queue work; a synchronous getter still sees the previous value.
      nativeStoreSet: (key: string, value: string) => {
        nativeWrites.push(() => nativeStore.set(key, value));
      },
    }),
  },
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ActivityIndicator: () => null,
}));
vi.mock("../state/preferences", () => ({ mobilePreferencesAtom: {} }));
vi.mock("@effect/atom-react", async () => {
  const { AsyncResult } = await import("effect/reactivity");
  return { useAtomValue: () => AsyncResult.success({ interfaceLanguage: language.value }) };
});

import { UiLanguageContext } from "../i18n";
import { I18nProvider, useGT } from "./I18nProvider";

function SettingsLabels() {
  const gt = useGT();
  return (
    <>
      <span>
        {["Settings", "Connections", "General", "Language"].map((label) => gt(label)).join("|")}
      </span>
      <output>{gt("No settings match “{query}”.", { query: "Settings Default Claude" })}</output>
    </>
  );
}

it("loads Hebrew Settings through the native GT provider on startup and language changes", async () => {
  nativeStore.clear();
  nativeWrites.length = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  using _globals = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
  const container = document.createElement("div");
  const root = createRoot(container);
  using _root = { [Symbol.dispose]: () => act(() => root.unmount()) };
  const labels = () => container.querySelector("span")?.textContent;
  const render = async (locale: UiLocale) => {
    language.value = locale;
    await act(async () => {
      root.render(
        <UiLanguageContext.Provider
          value={{ locale, direction: "ltr", t: createUiTranslator(locale) }}
        >
          <I18nProvider>
            <SettingsLabels />
          </I18nProvider>
        </UiLanguageContext.Provider>,
      );
    });
    for (const write of nativeWrites.splice(0)) write();
  };
  await render("he");
  expect(labels()).toBe("הגדרות|חיבורים|כללי|שפה");
  expect(container.querySelector("output")?.textContent).toBe(
    "אין הגדרות שתואמות ל־“Settings Default Claude”.",
  );
  await render("en");
  expect(labels()).toBe("Settings|Connections|General|Language");
  await render("he");
  expect(labels()).toBe("הגדרות|חיבורים|כללי|שפה");

  const cache = getReactI18nCache();
  const loadTranslations = cache.loadTranslations.bind(cache);
  const spanish = Promise.withResolvers<Awaited<ReturnType<typeof loadTranslations>>>();
  using _load = vi
    .spyOn(cache, "loadTranslations")
    .mockImplementation((locale) => (locale === "es" ? spanish.promise : loadTranslations(locale)));
  await render("es");
  expect(labels()).toBe("הגדרות|חיבורים|כללי|שפה");
  await act(async () => spanish.resolve(await loadTranslations("es")));
  expect(labels()?.split("|")[0]).toBe("Ajustes");

  for (const [locale, settings] of [
    ["ar", "الإعدادات"],
    ["fa", "تنظیمات"],
    ["de", "Einstellungen"],
    ["fr", "Paramètres"],
    ["ja", "設定"],
    ["ko", "설정"],
    ["pt-BR", "Configurações"],
    ["ru", "Настройки"],
    ["zh", "设置"],
  ] as const) {
    await render(locale);
    expect(labels()?.split("|")[0], locale).toBe(settings);
    expect(container.querySelector("output")?.textContent, locale).toContain(
      "Settings Default Claude",
    );
  }
});
