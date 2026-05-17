import { type BuildOptions, build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const options: BuildOptions = {
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
