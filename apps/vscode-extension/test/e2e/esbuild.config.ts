import { type BuildOptions, build } from "esbuild";

const options: BuildOptions = {
  bundle: true,
  entryPoints: ["test/e2e/suite.ts"],
  external: ["vscode"],
  format: "cjs",
  logLevel: "info",
  minify: false,
  outfile: "dist/e2e/suite.cjs",
  platform: "node",
  sourcemap: true,
  target: "node22",
};

await build(options);
