import path from "node:path";
import { fileURLToPath } from "node:url";

import { runTests } from "@vscode/test-electron";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(testRoot, "..", "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");

await runTests({
  extensionDevelopmentPath: extensionRoot,
  extensionTestsPath: path.join(extensionRoot, "dist", "e2e", "suite.cjs"),
  launchArgs: [path.join(repoRoot, "examples", "basic")],
});
