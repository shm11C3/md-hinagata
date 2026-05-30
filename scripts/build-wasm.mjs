import { spawnSync } from "node:child_process";
import { existsSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
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
optimizeWasm(path.join(wasmOutputDir, "md_hinagata_wasm_bg.wasm"));
copyWasmToExtension({
  sourceDir: wasmOutputDir,
});

// Shrink the wasm-bindgen output with wasm-opt (binaryen). Combined with the
// size-first cargo release profile this is the largest reduction in the VSIX.
function optimizeWasm(wasmFile) {
  const wasmOpt = resolveWasmOpt();
  if (!wasmOpt) {
    console.warn(
      "wasm-opt not found; shipping the unoptimized wasm. Run `pnpm install` to provide binaryen.",
    );
    return;
  }

  const before = statSync(wasmFile).size;
  run(wasmOpt, [
    "-Oz",
    // The Rust wasm target emits bulk-memory / sign-ext / etc. ops that
    // wasm-opt rejects unless the matching features are enabled. Allow all of
    // them so validation passes; the runtime (recent VS Code/Electron) supports
    // every stable wasm feature.
    "--all-features",
    "--strip-debug",
    "--strip-producers",
    wasmFile,
    "-o",
    wasmFile,
  ]);
  const after = statSync(wasmFile).size;
  const saved = (((before - after) / before) * 100).toFixed(1);
  console.log(`wasm-opt: ${before} -> ${after} bytes (-${saved}%)`);
}

// Prefer the version pinned via the `binaryen` devDependency so local and CI
// builds share one optimizer, then fall back to one on PATH.
function resolveWasmOpt() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require.resolve("binaryen/package.json");
    const bin = path.join(path.dirname(pkg), "bin", "wasm-opt");
    if (existsSync(bin)) {
      return bin;
    }
  } catch {
    // binaryen not installed; fall through to PATH lookup.
  }

  const local = path.join(repoRoot, "node_modules", ".bin", "wasm-opt");
  return existsSync(local) ? local : null;
}

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

  const currentVersion = result.stdout
    .trim()
    .match(/^wasm-bindgen\s+([^\s]+)/)?.[1];
  if (currentVersion !== WASM_BINDGEN_VERSION) {
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
