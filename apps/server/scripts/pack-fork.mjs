import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { parse } from "yaml";
import { selectCliRuntimeExternalDependencies } from "../../../scripts/lib/cli-external-packages.ts";

// --prepare stamps the disposable CI checkout before bundling its manifest.
const serverDir = NodeURL.fileURLToPath(new URL("..", import.meta.url));
const repoRoot = NodePath.resolve(serverDir, "../..");
const manifest = JSON.parse(
  await NodeFSP.readFile(NodePath.join(serverDir, "package.json"), "utf8"),
);
if (process.argv.includes("--prepare")) {
  if (!process.env.CI || !process.env.APP_VERSION) {
    throw new Error("Version preparation requires CI and APP_VERSION");
  }
  manifest.version = process.env.APP_VERSION;
  manifest.t3PackageSpec = `https://github.com/ttv20/t3code/releases/download/v${process.env.APP_VERSION}/t3-${process.env.APP_VERSION}.tgz`;
  await NodeFSP.writeFile(
    NodePath.join(serverDir, "package.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  process.exit(0);
}
const workspace = parse(
  await NodeFSP.readFile(NodePath.join(repoRoot, "pnpm-workspace.yaml"), "utf8"),
);
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
const stagingDir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-fork-package-"));
const outputDir = NodePath.join(repoRoot, "fork-release");
await NodeFSP.mkdir(outputDir, { recursive: true });
await NodeFSP.cp(NodePath.join(serverDir, "dist"), NodePath.join(stagingDir, "dist"), {
  recursive: true,
});
await NodeFSP.cp(NodePath.join(repoRoot, "LICENSE"), NodePath.join(stagingDir, "LICENSE"));
await NodeFSP.writeFile(
  NodePath.join(stagingDir, "package.json"),
  JSON.stringify(
    {
      name: "t3",
      version: process.env.APP_VERSION || manifest.version,
      type: "module",
      license: manifest.license,
      repository: { type: "git", url: "https://github.com/ttv20/t3code" },
      t3PackageSpec: manifest.t3PackageSpec,
      bin: manifest.bin,
      files: ["dist", "LICENSE"],
      engines: { node: "^24.13.1" },
      dependencies,
    },
    null,
    2,
  ) + "\n",
);
NodeChildProcess.execFileSync("npm", ["pack", "--pack-destination", outputDir], {
  cwd: stagingDir,
  stdio: "inherit",
});
