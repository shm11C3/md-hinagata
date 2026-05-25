import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const extensionDir = path.join(repoRoot, "apps", "vscode-extension");
const licenseFiles = ["LICENSE", "LICENSE-MIT", "LICENSE-APACHE"];
const generatedAssetDirectories = ["themes"];

export function prepareVscodeExtensionPackage({
  packageExtensionDir = extensionDir,
  packageRepoRoot = repoRoot,
} = {}) {
  if (!existsSync(packageExtensionDir)) {
    fail(`Extension directory not found: ${packageExtensionDir}`);
  }

  for (const filename of licenseFiles) {
    const source = path.join(packageRepoRoot, filename);
    const destination = path.join(packageExtensionDir, filename);

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

  for (const directory of generatedAssetDirectories) {
    const source = path.join(packageRepoRoot, directory);
    const destination = path.join(packageExtensionDir, directory);

    if (!existsSync(source)) {
      fail(`Bundled extension asset directory not found: ${source}`);
    }

    try {
      rmSync(destination, { force: true, recursive: true });
      mkdirSync(path.dirname(destination), { recursive: true });
      cpSync(source, destination, { recursive: true });
    } catch (error) {
      fail(
        `Failed to sync ${directory} into the VS Code extension package.`,
        error,
      );
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareVscodeExtensionPackage();
}

function fail(message, error) {
  console.error(message);
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
}
