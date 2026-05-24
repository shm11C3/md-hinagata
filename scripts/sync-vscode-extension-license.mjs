import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const extensionDir = path.join(repoRoot, "apps", "vscode-extension");
const licenseFiles = ["LICENSE", "LICENSE-MIT", "LICENSE-APACHE"];

if (!existsSync(extensionDir)) {
  fail(`Extension directory not found: ${extensionDir}`);
}

for (const filename of licenseFiles) {
  const source = path.join(repoRoot, filename);
  const destination = path.join(extensionDir, filename);

  if (!existsSync(source)) {
    fail(`License file not found: ${source}`);
  }

  try {
    copyFileSync(source, destination);
  } catch (error) {
    fail(
      `Failed to sync ${filename} into the VS Code extension package.`,
      error,
    );
  }
}

function fail(message, error) {
  console.error(message);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
