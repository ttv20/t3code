import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { selectCliRuntimeExternalDependencies } from "../../../scripts/lib/cli-external-packages.ts";

// --prepare stamps the disposable CI checkout before bundling its manifest.
const serverDir = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = path.resolve(serverDir, "../..");
const manifest = JSON.parse(await readFile(path.join(serverDir, "package.json"), "utf8"));
if (process.argv.includes("--prepare")) {
  if (!process.env.CI || !process.env.APP_VERSION) {
    throw new Error("Version preparation requires CI and APP_VERSION");
  }
  manifest.version = process.env.APP_VERSION;
  await writeFile(path.join(serverDir, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
  process.exit(0);
}
const workspace = parse(await readFile(path.join(repoRoot, "pnpm-workspace.yaml"), "utf8"));
const dependencies = Object.fromEntries(
  Object.entries(selectCliRuntimeExternalDependencies(manifest.dependencies)).map(
    ([name, spec]) => {
      if (!spec.startsWith("catalog:")) return [name, spec];
      const key = spec.slice("catalog:".length).trim() || name;
      const resolved = workspace.catalog[key];
      if (!resolved) throw new Error(`Missing catalog dependency: ${key}`);
      return [name, resolved];
    },
  ),
);
const stagingDir = await mkdtemp(path.join(tmpdir(), "t3-fork-package-"));
const outputDir = path.join(repoRoot, "fork-release");
await mkdir(outputDir, { recursive: true });
await cp(path.join(serverDir, "dist"), path.join(stagingDir, "dist"), { recursive: true });
await cp(path.join(repoRoot, "LICENSE"), path.join(stagingDir, "LICENSE"));
await writeFile(
  path.join(stagingDir, "package.json"),
  JSON.stringify(
    {
      name: "t3",
      version: process.env.APP_VERSION || manifest.version,
      type: "module",
      license: manifest.license,
      repository: { type: "git", url: "https://github.com/ttv20/t3code" },
      bin: manifest.bin,
      files: ["dist", "LICENSE"],
      engines: { node: "^24.13.1" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);
execFileSync("npm", ["pack", "--pack-destination", outputDir], {
  cwd: stagingDir,
  stdio: "inherit",
});
