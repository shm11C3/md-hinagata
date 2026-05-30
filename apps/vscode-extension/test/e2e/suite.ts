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
  const extension = assertExtensionInstalled();
  await openBasicSample();
  await assertExtensionActivatedByMarkdown(extension);
  await assertCommandsRegistered();
  await assertPreviewAndCopyCommandsRun();
  await assertCommandsRefreshVisibleMarkdownWhenVisibleFileChangesWithoutFocus();
  await assertThemeStateFollowsSwitchedMarkdownFiles();
  await assertCommandsUseVisibleMarkdownWhenAnotherEditorIsActive();
  await assertCommandsUseLastMarkdownWhenNoEditorIsActive();
  await assertLargePreviewUpdatePerformance();
  await assertCreateThemeFromDefaultCommandRuns();
}

function assertExtensionInstalled(): vscode.Extension<unknown> {
  const extension = vscode.extensions.all.find(
    (candidate) =>
      candidate.packageJSON?.name === "md-hinagata-vscode-extension",
  );

  assert.ok(extension, "md-hinagata extension should be installed.");
  assertPackagedExtensionSource(extension);
  return extension;
}

function assertPackagedExtensionSource(
  extension: vscode.Extension<unknown>,
): void {
  if (process.env.MD_HINAGATA_E2E_MODE !== "packaged") {
    return;
  }

  const sourcePath = process.env.MD_HINAGATA_EXTENSION_SOURCE_PATH;
  assert.ok(sourcePath, "packaged E2E should provide the source path.");
  assert.notEqual(
    path.resolve(extension.extensionPath),
    path.resolve(sourcePath),
    "packaged E2E should load md-hinagata from an installed VSIX, not the source extensionDevelopmentPath.",
  );

  const extensionsDir = process.env.MD_HINAGATA_E2E_EXTENSIONS_DIR;
  assert.ok(extensionsDir, "packaged E2E should provide the extensions dir.");
  assert.ok(
    isWithinDirectory(extensionsDir, extension.extensionPath),
    `packaged E2E should install md-hinagata under ${extensionsDir}; actual path was ${extension.extensionPath}.`,
  );
}

async function assertExtensionActivatedByMarkdown(
  extension: vscode.Extension<unknown>,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (extension.isActive) {
      return;
    }

    await delay(25);
  }

  assert.fail("md-hinagata should activate after opening a Markdown document.");
}

async function openBasicSample(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  const document = await showMarkdownDocument(sampleUri);
  assert.equal(document.uri.fsPath, sampleUri.fsPath);
}

async function assertCommandsRegistered(): Promise<void> {
  const commands = await vscode.commands.getCommands(false);

  for (const commandId of COMMAND_IDS) {
    assert.ok(
      commands.includes(commandId),
      `${commandId} should be visible as a registered command.`,
    );
  }
}

async function assertPreviewAndCopyCommandsRun(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  await openBasicSample();

  const generatedHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /\.basic-heading/,
  });
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

async function assertThemeStateFollowsSwitchedMarkdownFiles(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitForNoActiveTextEditor();
  await waitForNoVisibleTextEditors();

  const basicUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "e2e-switch-basic.md"),
  );
  const releaseUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "e2e-switch-release.md"),
  );
  await writeFile(
    basicUri.fsPath,
    createThemeSwitchMarkdown({
      title: "Basic switch smoke",
      themeId: "basic",
    }),
    "utf8",
  );
  await writeFile(
    releaseUri.fsPath,
    createThemeSwitchMarkdown({
      title: "Release switch smoke",
      themeId: "release-note",
    }),
    "utf8",
  );

  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await showMarkdownDocument(basicUri);
  await waitForSingleVisibleMarkdownEditor(basicUri.fsPath);
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  const basicHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /basic-heading--h1/,
  });
  assert.match(basicHtml, /basic-heading--h1/);
  assert.doesNotMatch(basicHtml, /release-heading--h1/);

  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await showMarkdownDocument(releaseUri);
  await waitForSingleVisibleMarkdownEditor(releaseUri.fsPath);
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  const releaseHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /release-heading--h1/,
  });
  assert.match(releaseHtml, /release-heading--h1/);
  assert.doesNotMatch(releaseHtml, /basic-heading--h1/);

  const selectedTheme = await vscode.commands.executeCommand<string>(
    "md-hinagata.selectTheme",
    "docs-clean",
  );
  assert.equal(selectedTheme, "docs-clean");
  const selectedHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /docs-heading--h1/,
  });
  assert.match(selectedHtml, /docs-heading--h1/);

  const basicDocument = await vscode.workspace.openTextDocument(basicUri);
  const releaseDocument = await vscode.workspace.openTextDocument(releaseUri);
  assert.match(basicDocument.getText(), /theme: basic/);
  assert.match(releaseDocument.getText(), /theme: docs-clean/);

  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await showMarkdownDocument(basicUri);
  await waitForSingleVisibleMarkdownEditor(basicUri.fsPath);
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  const switchedBackHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /basic-heading--h1/,
  });
  assert.match(switchedBackHtml, /basic-heading--h1/);
  assert.doesNotMatch(switchedBackHtml, /docs-heading--h1/);

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitForNoActiveTextEditor();
  await waitForNoVisibleTextEditors();
}

async function assertCommandsUseVisibleMarkdownWhenAnotherEditorIsActive(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  await closePreviewTabs(PREVIEW_PANEL_TITLE);
  await openBasicSample();
  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  await showPlainTextDocumentBeside("visible-markdown-notes.txt");
  assert.equal(
    vscode.window.activeTextEditor?.document.languageId,
    "plaintext",
  );
  await waitForSingleVisibleMarkdownEditor(sampleUri.fsPath);

  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);

  const selectedTheme = await vscode.commands.executeCommand<string>(
    "md-hinagata.selectTheme",
    "default",
  );
  assert.equal(selectedTheme, "default");

  const sampleDocument = await vscode.workspace.openTextDocument(sampleUri);
  assert.match(sampleDocument.getText(), /theme: default/);
}

async function assertCommandsRefreshVisibleMarkdownWhenVisibleFileChangesWithoutFocus(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await openBasicSample();
  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  await showPlainTextDocumentBeside("switch-theme-notes.txt");
  assert.equal(
    vscode.window.activeTextEditor?.document.languageId,
    "plaintext",
  );
  await waitForSingleVisibleMarkdownEditor(sampleUri.fsPath);

  const knowledgeBaseUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "knowledge-base.md"),
  );
  const knowledgeBaseDocument =
    await vscode.workspace.openTextDocument(knowledgeBaseUri);
  await vscode.window.showTextDocument(knowledgeBaseDocument, {
    preserveFocus: true,
    preview: false,
    viewColumn: vscode.ViewColumn.One,
  });
  assert.equal(
    vscode.window.activeTextEditor?.document.languageId,
    "plaintext",
  );
  await waitForSingleVisibleMarkdownEditor(knowledgeBaseUri.fsPath);

  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);

  const selectedTheme = await vscode.commands.executeCommand<string>(
    "md-hinagata.selectTheme",
    "default",
  );
  assert.equal(selectedTheme, "default");

  const updatedKnowledgeBaseDocument =
    await vscode.workspace.openTextDocument(knowledgeBaseUri);
  assert.match(updatedKnowledgeBaseDocument.getText(), /theme: default/);

  const sampleDocument = await vscode.workspace.openTextDocument(sampleUri);
  assert.match(sampleDocument.getText(), /theme: basic/);

  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

async function assertCommandsUseLastMarkdownWhenNoEditorIsActive(): Promise<void> {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await waitForNoActiveTextEditor();
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

async function waitForNoVisibleTextEditors(): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (vscode.window.visibleTextEditors.length === 0) {
      return;
    }

    await delay(25);
  }

  assert.fail("Expected no visible text editors.");
}

async function assertCreateThemeFromDefaultCommandRuns(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const createdThemeId = "e2e-theme";
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await openBasicSample();
  const sampleUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, "sample.md"),
  );
  await showPlainTextDocumentBeside("create-theme-notes.txt");
  assert.equal(
    vscode.window.activeTextEditor?.document.languageId,
    "plaintext",
  );
  await waitForSingleVisibleMarkdownEditor(sampleUri.fsPath);
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

  const sampleDocument = await vscode.workspace.openTextDocument(sampleUri);
  assert.match(sampleDocument.getText(), /theme: e2e-theme/);

  await openBasicSample();
  await vscode.commands.executeCommand("md-hinagata.openPreview");
  await waitForPreviewTab(PREVIEW_PANEL_TITLE);
  await openBasicSample();
  const generatedHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /mh-heading--h1/,
  });
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
  const generatedHtml = await copyActiveMarkdownGeneratedHtml({
    expectedPattern: /Section 400/,
  });
  assert.match(generatedHtml, /Large benchmark document/);
  assert.match(generatedHtml, /Section 400/);
}

async function copyActiveMarkdownGeneratedHtml(options: {
  expectedPattern: RegExp;
}): Promise<string> {
  const deadline = Date.now() + 5_000;
  let lastGeneratedHtml = "";
  let lastCopied: boolean | undefined;

  while (Date.now() < deadline) {
    lastCopied = await vscode.commands.executeCommand<boolean>(
      "md-hinagata.copyGeneratedHtml",
    );
    lastGeneratedHtml = await vscode.env.clipboard.readText();

    if (
      lastCopied === true &&
      options.expectedPattern.test(lastGeneratedHtml)
    ) {
      return lastGeneratedHtml;
    }

    await delay(100);
  }

  assert.equal(lastCopied, true, "copyGeneratedHtml should report success.");
  assert.match(lastGeneratedHtml, options.expectedPattern);
  return lastGeneratedHtml;
}

async function showPlainTextDocumentBeside(fileName: string): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspaceFolder, "E2E test workspace should be open.");

  const notesUri = vscode.Uri.file(
    path.join(workspaceFolder.uri.fsPath, fileName),
  );
  await writeFile(notesUri.fsPath, "plain text notes\n", "utf8");
  const notesDocument = await vscode.workspace.openTextDocument(notesUri);
  await vscode.window.showTextDocument(notesDocument, {
    preview: false,
    viewColumn: vscode.ViewColumn.Beside,
  });
}

async function showMarkdownDocument(
  uri: vscode.Uri,
): Promise<vscode.TextDocument> {
  const document = await vscode.workspace.openTextDocument(uri);
  assert.equal(document.languageId, "markdown");
  await vscode.window.showTextDocument(document, { preview: false });
  return document;
}

async function waitForSingleVisibleMarkdownEditor(
  fsPath: string,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const markdownUris = new Set(
      vscode.window.visibleTextEditors
        .filter((editor) => editor.document.languageId === "markdown")
        .map((editor) => editor.document.uri.fsPath),
    );
    if (markdownUris.size === 1 && markdownUris.has(fsPath)) {
      return;
    }

    await delay(25);
  }

  assert.fail(
    `Markdown editor '${fsPath}' was not the only visible Markdown editor.`,
  );
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

function isWithinDirectory(parent: string, child: string): boolean {
  const relativePath = path.relative(path.resolve(parent), path.resolve(child));
  return relativePath === "" || !relativePath.startsWith("..");
}

function createThemeSwitchMarkdown({
  themeId,
  title,
}: {
  themeId: string;
  title: string;
}): string {
  return [
    "---",
    "hinagata:",
    `  theme: ${themeId}`,
    "  output: fragment",
    "---",
    "",
    `# ${title}`,
    "",
    "This fixture verifies that packaged smoke tests follow the active Markdown file.",
    "",
  ].join("\n");
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
