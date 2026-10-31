import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Translation catalogs are large default-only imports; skip thousands of unused named exports.
  json: { namedExports: false, stringify: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["../shared/src/testing/longTempDir.ts", "../shared/src/testing/providerEnv.ts"],
  },
});
