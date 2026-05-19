import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

const COMMAND_IDS = [
  "md-hinagata.openPreview",
  "md-hinagata.copyGeneratedHtml",
  "md-hinagata.selectTheme",
] as const;

export async function run(): Promise<void> {
  await activateExtension();
  await openBasicSample();
  await assertCommandsRegistered();
  await assertPreviewAndCopyCommandsRun();
}

async function activateExtension(): Promise<void> {
  const extension = vscode.extensions.all.find(
    (candidate) =>
      candidate.packageJSON?.name === "md-hinagata-vscode-extension",
  );

  assert.ok(extension, "md-hinagata extension should be installed.");
  await extension.activate();
}

async function openBasicSample(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  const document = await vscode.workspace.openTextDocument(sampleUri);
  assert.equal(document.languageId, "markdown");

  await vscode.window.showTextDocument(document);
  assert.equal(
    vscode.window.activeTextEditor?.document.uri.fsPath,
    sampleUri.fsPath,
  );
}

async function assertCommandsRegistered(): Promise<void> {
  const commands = await vscode.commands.getCommands(true);

  for (const commandId of COMMAND_IDS) {
    assert.ok(
      commands.includes(commandId),
      `${commandId} should be registered.`,
    );
  }
}

async function assertPreviewAndCopyCommandsRun(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await vscode.commands.executeCommand("md-hinagata.copyGeneratedHtml");

  const generatedHtml = await vscode.env.clipboard.readText();
  const expectedHtml = await readFile(
    path.join(workspaceFolder.uri.fsPath, "expected.html"),
    "utf8",
  );

  assert.equal(generatedHtml, expectedHtml.trimEnd());
  assert.match(generatedHtml, /<style>/);
  assert.match(generatedHtml, /\.basic-heading/);
}
