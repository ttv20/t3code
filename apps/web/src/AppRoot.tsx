import { RouterProvider } from "@tanstack/react-router";
import { UiLanguageProvider } from "./UiLanguageProvider";

import { ElectronBrowserHost } from "./browser/ElectronBrowserHost";
import { QuitHoldOverlay } from "./components/QuitHoldOverlay";
import type { AppRouter } from "./router";
import { AppAtomRegistryProvider } from "./rpc/atomRegistry";

// Keep webviews outside the router but inside its atom registry so route changes preserve them.
export function AppRoot({ router }: { readonly router: AppRouter }) {
  return (
    <AppAtomRegistryProvider>
      <UiLanguageProvider>
        <RouterProvider router={router} />
        <ElectronBrowserHost />
        <QuitHoldOverlay />
      </UiLanguageProvider>
    </AppAtomRegistryProvider>
  );
}
