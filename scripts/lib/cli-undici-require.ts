// @effect-diagnostics nodeBuiltinImport:off -- Build configuration reads the installed external package's export names.
import * as NodeModule from "node:module";

export function cliUndiciRequirePlugin() {
  return {
    name: "t3-cli-undici-require",
    load(id: string): string | undefined {
      if (!id.replaceAll("\\", "/").endsWith("/@effect/platform-node/dist/Undici.js")) return;
      const requireServer = NodeModule.createRequire(
        new URL("../../apps/server/package.json", import.meta.url),
      );
      const undici = requireServer("undici") as Record<string, unknown>;
      // SEA resolves only builtin ESM imports; preserve Effect's exports through filesystem require.
      return [
        'import { createRequire } from "node:module";',
        'const undici = createRequire(import.meta.url)("undici");',
        "export default undici;",
        ...Object.keys(undici)
          .filter((key) => key !== "default")
          .map((key) => `export const ${key} = undici[${JSON.stringify(key)}];`),
      ].join("\n");
    },
  };
}
