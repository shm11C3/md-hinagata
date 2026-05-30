import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTests } from "@vscode/test-electron";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(testRoot, "..", "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "md-hinagata-e2e-"));
const temporaryWorkspace = path.join(temporaryRoot, "basic");
const temporaryUserData = path.join(temporaryRoot, "user-data");

try {
  await cp(path.join(repoRoot, "examples", "basic"), temporaryWorkspace, {
    recursive: true,
  });

  await runTests({
    extensionDevelopmentPath: extensionRoot,
    extensionTestsPath: path.join(extensionRoot, "dist", "e2e", "suite.cjs"),
    launchArgs: [`--user-data-dir=${temporaryUserData}`, temporaryWorkspace],
  });
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
