import { copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const extensionDir = path.join(repoRoot, "apps", "vscode-extension");
const licenseFiles = ["LICENSE", "LICENSE-MIT", "LICENSE-APACHE"];

for (const filename of licenseFiles) {
  copyFileSync(
    path.join(repoRoot, filename),
    path.join(extensionDir, filename),
  );
}
