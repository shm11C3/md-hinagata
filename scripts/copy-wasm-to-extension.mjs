import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

export function copyWasmToExtension({
  sourceDir = path.join(repoRoot, "target", "wasm-bindgen", "md-hinagata-wasm"),
  destinationDir = path.join(repoRoot, "apps", "vscode-extension", "wasm"),
} = {}) {
  rmSync(destinationDir, { recursive: true, force: true });
  mkdirSync(destinationDir, { recursive: true });
  cpSync(sourceDir, destinationDir, { recursive: true });
  writeFileSync(
    path.join(destinationDir, "package.json"),
    `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  copyWasmToExtension();
}
