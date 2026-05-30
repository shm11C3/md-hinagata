import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import * as vscode from "vscode";

const COMMAND_IDS = [
  "md-hinagata.openPreview",
  "md-hinagata.copyGeneratedHtml",
  "md-hinagata.selectTheme",
  "md-hinagata.createThemeFromDefault",
] as const;

const PREVIEW_PANEL_TITLE = "md-hinagata Preview";
const E2E_PERFORMANCE_SECTION_COUNT = 400;
const E2E_PREVIEW_UPDATE_LIMIT_MS = 5_000;

export async function run(): Promise<void> {
  await activateExtension();
  await openBasicSample();
  await assertCommandsRegistered();
  await assertPreviewAndCopyCommandsRun();
  await assertCommandsUseLastMarkdownWhenNoEditorIsActive();
  await assertLargePreviewUpdatePerformance();
  await assertCreateThemeFromDefaultCommandRuns();
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
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  await openBasicSample();

  const generatedHtml = await copyActiveMarkdownGeneratedHtml();
  const expectedHtml = await readFile(
    path.join(workspaceFolder.uri.fsPath, "expected.html"),
    "utf8",
  );

  assert.equal(
    normalizeGeneratedHtml(generatedHtml),
    normalizeGeneratedHtml(expectedHtml),
  );
  assert.match(generatedHtml, /<style>/);
  assert.match(generatedHtml, /\.basic-heading/);
}

async function assertCommandsUseLastMarkdownWhenNoEditorIsActive(): Promise<void> {
  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await openBasicSample();
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitForNoActiveTextEditor();

  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);

  const selectedTheme = await vscode.commands.executeCommand<string>(
    "md-hinagata.selectTheme",
    "basic",
  );
  assert.equal(selectedTheme, "basic");
}

async function waitForNoActiveTextEditor(): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (vscode.window.activeTextEditor === undefined) {
      return;
    }

    await delay(25);
  }

  assert.fail("Expected no active text editor.");
}

async function assertCreateThemeFromDefaultCommandRuns(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const createdThemeId = "e2e-theme";
  await openBasicSample();
  await vscode.commands.executeCommand("md-hinagata.createThemeFromDefault", {
    themeId: createdThemeId,
    workspaceFolderUri: workspaceFolder.uri.toString(),
  });

  const createdThemeRoot = path.join(
    workspaceFolder.uri.fsPath,
    ".md-hinagata",
    "themes",
    createdThemeId,
  );
  const createdManifest = JSON.parse(
    await readFile(path.join(createdThemeRoot, "theme.json"), "utf8"),
  ) as { id?: string; name?: string };
  assert.equal(createdManifest.id, createdThemeId);
  assert.equal(createdManifest.name, "E2e Theme");

  const createdStyles = await readFile(
    path.join(createdThemeRoot, "styles.css"),
    "utf8",
  );
  assert.match(createdStyles, /\.mh-document/);
  assert.match(createdStyles, /\.mh-heading/);

  for (const templateName of [
    "h1",
    "h2",
    "h3",
    "p",
    "codeblock",
    "blockquote",
    "ul",
    "ol",
    "li",
  ]) {
    const templateSource = await readFile(
      path.join(createdThemeRoot, "templates", `${templateName}.hbs`),
      "utf8",
    );
    assert.ok(
      templateSource.trim().length > 0,
      `${templateName}.hbs should be copied.`,
    );
  }

  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  const sampleDocument = await vscode.workspace.openTextDocument(sampleUri);
  assert.match(sampleDocument.getText(), /theme: e2e-theme/);

  await openBasicSample();
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  await openBasicSample();
  const generatedHtml = await copyActiveMarkdownGeneratedHtml();
  assert.match(generatedHtml, /mh-heading--h1/);
  assert.match(generatedHtml, /mh-codeblock/);
}

async function assertLargePreviewUpdatePerformance(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const largeSampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "large-preview-e2e.md"),
  );
  await writeFile(
    largeSampleUri.fsPath,
    createLargeMarkdown(E2E_PERFORMANCE_SECTION_COUNT),
    "utf8",
  );
  const document = await vscode.workspace.openTextDocument(largeSampleUri);
  await vscode.window.showTextDocument(document);
  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await vscode.window.showTextDocument(document);

  const startedAt = performance.now();
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  const elapsedMs = performance.now() - startedAt;

  console.log(
    `md-hinagata E2E preview update: ${elapsedMs.toFixed(2)}ms for ${E2E_PERFORMANCE_SECTION_COUNT} sections`,
  );
  assert.ok(
    elapsedMs < E2E_PREVIEW_UPDATE_LIMIT_MS,
    `large preview update should complete under ${E2E_PREVIEW_UPDATE_LIMIT_MS}ms; observed ${elapsedMs.toFixed(2)}ms`,
  );

  await vscode.window.showTextDocument(document);
  const generatedHtml = await copyActiveMarkdownGeneratedHtml();
  assert.match(generatedHtml, /Large benchmark document/);
  assert.match(generatedHtml, /Section 400/);
}

async function copyActiveMarkdownGeneratedHtml(): Promise<string> {
  const copied = await vscode.commands.executeCommand<boolean>(
    "md-hinagata.copyGeneratedHtml",
  );
  assert.equal(copied, true, "copyGeneratedHtml should report success.");
  return vscode.env.clipboard.readText();
}

async function closePreviewTabs(title: string): Promise<void> {
  const previewTabs = getTabs(title);
  if (previewTabs.length === 0) {
    return;
  }

  await vscode.window.tabGroups.close(previewTabs, true);
  await waitForPreviewTabsClosed(title);
}

async function waitForPreviewTab(title: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (hasTab(title)) {
      return;
    }

    await delay(25);
  }

  assert.fail(`Preview tab '${title}' was not visible.`);
}

async function waitForPreviewTabsClosed(title: string): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!hasTab(title)) {
      return;
    }

    await delay(25);
  }

  assert.fail(`Preview tab '${title}' was still visible.`);
}

function hasTab(title: string): boolean {
  return getTabs(title).length > 0;
}

function getTabs(title: string): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.filter((tab) => tab.label === title),
  );
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createLargeMarkdown(sectionCount: number): string {
  const parts = [
    "---",
    "hinagata:",
    "  theme: default",
    "  output: fragment",
    "---",
    "",
    "# Large benchmark document",
  ];

  for (let index = 1; index <= sectionCount; index += 1) {
    parts.push(
      "",
      `## Section ${index}`,
      "",
      `Paragraph ${index} keeps **strong text**, \`inline code\`, and enough words to exercise Markdown parsing and template rendering across a larger document.`,
      "",
      "> A short quoted note that remains inside the generated fragment.",
      "",
      "- First unordered item",
      "- Second unordered item with **inline emphasis**",
      "- Third unordered item with `code`",
      "",
      "```ts",
      `const section${index} = "benchmark";`,
      `console.log(section${index});`,
      "```",
    );
  }

  return parts.join("\n");
}

function normalizeGeneratedHtml(value: string): string {
  return value.replaceAll("\r\n", "\n").trimEnd();
}
