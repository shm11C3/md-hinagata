import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { copyWasmToExtension } from "./copy-wasm-to-extension.mjs";

const WASM_BINDGEN_VERSION = "0.2.121";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const wasmOutputDir = path.join(
  repoRoot,
  "target",
  "wasm-bindgen",
  "md-hinagata-wasm",
);
const wasmInput = path.join(
  repoRoot,
  "target",
  "wasm32-unknown-unknown",
  "release",
  "md_hinagata_wasm.wasm",
);

run("cargo", [
  "build",
  "--release",
  "--package",
  "md-hinagata-wasm",
  "--target",
  "wasm32-unknown-unknown",
]);

ensureWasmBindgen();
rmSync(wasmOutputDir, { recursive: true, force: true });
run("wasm-bindgen", [
  "--target",
  "nodejs",
  "--out-dir",
  wasmOutputDir,
  wasmInput,
]);
copyWasmToExtension({
  sourceDir: wasmOutputDir,
});

function ensureWasmBindgen() {
  const result = spawnSync("wasm-bindgen", ["--version"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error(
      `wasm-bindgen CLI was not found. Install it with: cargo install wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION} --locked`,
    );
  }

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  if (!result.stdout.includes(WASM_BINDGEN_VERSION)) {
    throw new Error(
      `wasm-bindgen CLI ${WASM_BINDGEN_VERSION} is required. Current version: ${result.stdout.trim()}`,
    );
  }

  if (!existsSync(wasmInput)) {
    throw new Error(`WASM artifact was not found: ${wasmInput}`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });

  if (result.error?.code === "ENOENT") {
    throw new Error(`Command not found: ${command}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
