import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
  runTests,
} from "@vscode/test-electron";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(testRoot, "..", "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");
const packagedMode = process.argv.includes("--packaged");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "md-hinagata-e2e-"));
const temporaryWorkspace = path.join(temporaryRoot, "basic");
const temporaryUserData = path.join(temporaryRoot, "user-data");
const temporaryExtensions = path.join(temporaryRoot, "extensions");
const extensionTestsPath = path.join(extensionRoot, "dist", "e2e", "suite.cjs");

try {
  await cp(path.join(repoRoot, "examples", "basic"), temporaryWorkspace, {
    recursive: true,
  });

  if (packagedMode) {
    await runPackagedVsixSmokeTest();
  } else {
    await runDevelopmentSmokeTest();
  }
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}

async function runDevelopmentSmokeTest(): Promise<void> {
  await runTests({
    extensionDevelopmentPath: extensionRoot,
    extensionTestsPath,
    launchArgs: createLaunchArgs(),
  });
}

async function runPackagedVsixSmokeTest(): Promise<void> {
  const vsixPath = path.join(temporaryRoot, "md-hinagata-e2e.vsix");
  await packageVsix(vsixPath);

  const vscodeExecutablePath = await downloadAndUnzipVSCode();
  installVsix({
    vscodeExecutablePath,
    vsixPath,
  });

  const harnessRoot = await createTestHarnessExtension();
  await withPackagedTestEnvironment(async () => {
    await runTests({
      extensionDevelopmentPath: harnessRoot,
      extensionTestsPath,
      launchArgs: createLaunchArgs(),
      vscodeExecutablePath,
    });
  });
}

async function packageVsix(vsixPath: string): Promise<void> {
  run(resolveNpxCommand(), [
    "@vscode/vsce",
    "package",
    "--no-dependencies",
    "--out",
    vsixPath,
  ]);
}

function installVsix({
  vscodeExecutablePath,
  vsixPath,
}: {
  vscodeExecutablePath: string;
  vsixPath: string;
}): void {
  const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(
    vscodeExecutablePath,
    {
      reuseMachineInstall: true,
    },
  );

  run(cliPath, [
    ...args,
    "--install-extension",
    vsixPath,
    "--force",
    `--user-data-dir=${temporaryUserData}`,
    `--extensions-dir=${temporaryExtensions}`,
  ]);
}

async function createTestHarnessExtension(): Promise<string> {
  const harnessRoot = path.join(temporaryRoot, "e2e-harness");
  await mkdir(harnessRoot, { recursive: true });
  await writeFile(
    path.join(harnessRoot, "package.json"),
    `${JSON.stringify(
      {
        activationEvents: [],
        engines: {
          vscode: "^1.120.0",
        },
        main: "./extension.js",
        name: "md-hinagata-e2e-harness",
        publisher: "md-hinagata",
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    path.join(harnessRoot, "extension.js"),
    "exports.activate = function activate() {};\nexports.deactivate = function deactivate() {};\n",
    "utf8",
  );
  return harnessRoot;
}

async function withPackagedTestEnvironment(
  callback: () => Promise<void>,
): Promise<void> {
  const previousMode = process.env.MD_HINAGATA_E2E_MODE;
  const previousSourcePath = process.env.MD_HINAGATA_EXTENSION_SOURCE_PATH;
  const previousExtensionsDir = process.env.MD_HINAGATA_E2E_EXTENSIONS_DIR;

  process.env.MD_HINAGATA_E2E_MODE = "packaged";
  process.env.MD_HINAGATA_EXTENSION_SOURCE_PATH = extensionRoot;
  process.env.MD_HINAGATA_E2E_EXTENSIONS_DIR = temporaryExtensions;

  try {
    await callback();
  } finally {
    restoreEnv("MD_HINAGATA_E2E_MODE", previousMode);
    restoreEnv("MD_HINAGATA_EXTENSION_SOURCE_PATH", previousSourcePath);
    restoreEnv("MD_HINAGATA_E2E_EXTENSIONS_DIR", previousExtensionsDir);
  }
}

function createLaunchArgs(): string[] {
  return [
    `--user-data-dir=${temporaryUserData}`,
    `--extensions-dir=${temporaryExtensions}`,
    "--disable-workspace-trust",
    temporaryWorkspace,
  ];
}

function run(command: string, args: readonly string[]): void {
  const result = spawnSync(command, [...args], {
    cwd: extensionRoot,
    encoding: "utf8",
    env: { ...process.env, NPM_CONFIG_YES: "true" },
    stdio: "inherit",
  });

  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  if (errorCode === "ENOENT") {
    throw new Error(`Command not found: ${command}`);
  }

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function resolveNpxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
