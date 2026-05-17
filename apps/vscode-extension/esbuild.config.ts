import path from "node:path";
import { fileURLToPath } from "node:url";
import { type BuildOptions, build, context } from "esbuild";

const watch = process.argv.includes("--watch");
const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const options: BuildOptions = {
  alias: {
    yaml: path.join(configDirectory, "node_modules/yaml/browser/index.js"),
  },
  bundle: true,
  entryPoints: ["src/extension.ts"],
  external: ["vscode"],
  format: "esm",
  logLevel: "info",
  minify: false,
  outfile: "dist/extension.js",
  platform: "node",
  sourcemap: true,
  target: "node22",
};

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
} else {
  await build(options);
}
