import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BuildOptions, build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const release = process.argv.includes("--release");
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const outfile = "dist/extension.js";

const options: BuildOptions = {
  alias: {
    yaml: path.join(configDirectory, "node_modules/yaml/browser/index.js"),
  },
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode"],
  format: "esm",
  logLevel: "info",
  minify: release,
  outfile,
  platform: "node",
  sourcemap: !release,
  target: "node22",
};

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
} else {
  if (release) {
    await rm(`${outfile}.map`, { force: true });
  }
  await build(options);
}
