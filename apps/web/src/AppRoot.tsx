import { RouterProvider } from "@tanstack/react-router";
import { UiLanguageProvider } from "./UiLanguageProvider";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import { I18nProvider } from "./i18n/I18nProvider";
import type { AppRouter } from "./router";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";

// Keep webviews outside the router but inside its atom registry so route changes preserve them.
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <UiLanguageProvider>
        <I18nProvider>
          <RouterProvider router={router} />
          <ElectronBrowserHost />
          <QuitHoldOverlay />
        </I18nProvider>
      </UiLanguageProvider>
    </AppAtomRegistryProvider>
  );
}
