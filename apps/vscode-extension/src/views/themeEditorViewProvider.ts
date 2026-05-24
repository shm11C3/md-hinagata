import type * as vscode from "vscode";

import { COMMAND_IDS } from "../commands/commandIds.js";
import type {
  DiagnosticMessage,
  DiagnosticsService,
} from "../services/diagnosticsService.js";
import type {
  DocumentState,
  DocumentStateService,
} from "../services/documentStateService.js";
import type { ThemeFileReference } from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { createWebviewHtml, escapeHtml } from "../utils/webviewHtml.js";

export const THEME_MANAGER_VIEW_ID = "md-hinagata.themeManager";

export class ThemeEditorViewProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  readonly #documentStateSubscription: vscode.Disposable;
  #webviewView: vscode.WebviewView | undefined;

  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly workspaceTrustService: WorkspaceTrustService,
  ) {
    this.#documentStateSubscription = this.documentStateService.subscribe(
      (state) => {
        this.diagnosticsService.replaceDiagnostics(state.diagnostics);
        this.render();
      },
    );
  }

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.#webviewView = webviewView;
    webviewView.webview.options = {
      enableCommandUris: [
        COMMAND_IDS.createThemeFromDefault,
        COMMAND_IDS.openThemeFile,
      ],
      enableScripts: false,
      localResourceRoots: [],
    };
    this.render();
  }

  public dispose(): void {
    this.#documentStateSubscription.dispose();
    this.#webviewView = undefined;
  }

  private render(): void {
    const webviewView = this.#webviewView;
    if (webviewView === undefined) {
      return;
    }

    webviewView.webview.html = createWebviewHtml({
      bodyHtml: renderThemeManagerBody({
        diagnostics: this.diagnosticsService.getDiagnostics(),
        isWorkspaceTrusted: this.workspaceTrustService.isTrusted,
        state: this.documentStateService.getState(),
      }),
      cspSource: webviewView.webview.cspSource,
      inlineStyles: [THEME_MANAGER_STYLES],
      title: "Theme Manager",
    });
  }
}

function renderThemeManagerBody(options: {
  diagnostics: readonly DiagnosticMessage[];
  isWorkspaceTrusted: boolean;
  state: DocumentState;
}): string {
  return [
    '<main class="mh-theme-manager">',
    renderCurrentDocument(options.state, options.isWorkspaceTrusted),
    renderActions(),
    renderThemeFiles(options.state),
    renderDiagnostics(options.diagnostics),
    "</main>",
  ].join("");
}

function renderCurrentDocument(
  state: DocumentState,
  isWorkspaceTrusted: boolean,
): string {
  if (state.status !== "active") {
    return [
      '<section class="mh-section">',
      "<h2>Current Document</h2>",
      '<p class="mh-empty">No active Markdown document.</p>',
      `<p class="mh-meta">Workspace trust: ${escapeHtml(isWorkspaceTrusted ? "trusted" : "untrusted")}</p>`,
      "</section>",
    ].join("");
  }

  const requestedTheme = state.frontmatter?.theme ?? state.currentTheme;
  const resolvedTheme = state.resolvedThemeId ?? "Not resolved";
  const output = state.frontmatter?.output ?? "fragment";
  const cssOutputMode = getCssOutputModeLabel(state);
  const generatedHtmlContract = getGeneratedHtmlContract(state);
  const fallbackHtml =
    state.resolvedThemeId !== undefined &&
    requestedTheme !== state.resolvedThemeId
      ? `<p class="mh-fallback">Fallback: ${escapeHtml(requestedTheme)} -> ${escapeHtml(state.resolvedThemeId)}</p>`
      : "";

  return [
    '<section class="mh-section">',
    "<h2>Current Document</h2>",
    '<dl class="mh-definition-list">',
    renderDefinition("Theme", requestedTheme),
    renderDefinition("Resolved Theme", resolvedTheme),
    renderDefinition("Output", output),
    renderDefinition("CSS Output Mode", cssOutputMode),
    renderDefinition("Generated HTML", generatedHtmlContract),
    renderDefinition(
      "Workspace trust",
      isWorkspaceTrusted ? "trusted" : "untrusted",
    ),
    "</dl>",
    fallbackHtml,
    "</section>",
  ].join("");
}

function getCssOutputModeLabel(state: DocumentState): string {
  const resolvedCssMode = state.resolvedCssMode;
  if (resolvedCssMode === undefined) {
    return "Not resolved";
  }

  const requestedCssMode = state.frontmatter?.cssMode;
  return requestedCssMode !== undefined && requestedCssMode !== resolvedCssMode
    ? `${requestedCssMode} -> ${resolvedCssMode}`
    : resolvedCssMode;
}

function getGeneratedHtmlContract(state: DocumentState): string {
  switch (state.resolvedCssMode) {
    case "style-tag":
      return "fragment with style tag";
    case "inline":
      return "fragment with inline styles";
    case "separate":
      return "fragment with separate CSS";
    case "none":
      return "fragment without theme CSS";
    case undefined:
      break;
  }

  if (state.resolvedThemeId === undefined) {
    return "Not resolved";
  }

  return "fragment";
}

function renderActions(): string {
  return [
    '<section class="mh-section">',
    "<h2>Actions</h2>",
    '<ul class="mh-file-list">',
    "<li>",
    `<a href="${escapeHtml(createCommandUri(COMMAND_IDS.createThemeFromDefault))}">`,
    "Create Theme from Default",
    "</a>",
    "</li>",
    "</ul>",
    "</section>",
  ].join("");
}

function renderThemeFiles(state: DocumentState): string {
  if (state.status !== "active" || state.currentThemeFiles.length === 0) {
    return [
      '<section class="mh-section">',
      "<h2>Theme Files</h2>",
      '<p class="mh-empty">No resolved theme files.</p>',
      "</section>",
    ].join("");
  }

  const themeFiles = state.currentThemeFiles.filter(
    (file) => file.kind !== "template",
  );
  const templateFiles = state.currentThemeFiles.filter(
    (file) => file.kind === "template",
  );

  return [
    '<section class="mh-section">',
    "<h2>Theme Files</h2>",
    renderThemeFileGroup("Theme Files", themeFiles),
    renderThemeFileGroup("Templates", templateFiles),
    "</section>",
  ].join("");
}

function renderThemeFileGroup(
  title: string,
  files: readonly ThemeFileReference[],
): string {
  if (files.length === 0) {
    return [
      '<div class="mh-file-group">',
      `<h3>${escapeHtml(title)}</h3>`,
      '<p class="mh-empty">None</p>',
      "</div>",
    ].join("");
  }

  return [
    '<div class="mh-file-group">',
    `<h3>${escapeHtml(title)}</h3>`,
    '<ul class="mh-file-list">',
    ...files.map(renderThemeFile),
    "</ul>",
    "</div>",
  ].join("");
}

function renderThemeFile(file: ThemeFileReference): string {
  const label =
    file.kind === "template" && file.templateKey !== undefined
      ? `${file.templateKey}: ${file.label}`
      : file.label;
  return [
    "<li>",
    `<a href="${escapeHtml(createOpenThemeFileCommandUri(file.path))}" title="${escapeHtml(file.path)}">`,
    `${escapeHtml(label)}`,
    "</a>",
    "</li>",
  ].join("");
}

function renderDiagnostics(diagnostics: readonly DiagnosticMessage[]): string {
  if (diagnostics.length === 0) {
    return [
      '<section class="mh-section">',
      "<h2>Diagnostics</h2>",
      '<p class="mh-empty">No issues</p>',
      "</section>",
    ].join("");
  }

  return [
    '<section class="mh-section">',
    "<h2>Diagnostics</h2>",
    '<ul class="mh-diagnostic-list">',
    ...diagnostics.map(renderDiagnostic),
    "</ul>",
    "</section>",
  ].join("");
}

function renderDiagnostic(diagnostic: DiagnosticMessage): string {
  const severity = diagnostic.severity ?? "warning";
  return [
    `<li class="mh-diagnostic mh-diagnostic--${escapeHtml(severity)}">`,
    '<div class="mh-diagnostic-header">',
    `<span>${escapeHtml(formatSeverity(severity))}</span>`,
    `<span>${escapeHtml(diagnostic.source)}</span>`,
    "</div>",
    `<p>${escapeHtml(diagnostic.message)}</p>`,
    "</li>",
  ].join("");
}

function renderDefinition(label: string, value: string): string {
  return [
    `<dt>${escapeHtml(label)}</dt>`,
    `<dd>${escapeHtml(value)}</dd>`,
  ].join("");
}

function createOpenThemeFileCommandUri(filePath: string): string {
  return `${createCommandUri(COMMAND_IDS.openThemeFile)}?${encodeURIComponent(JSON.stringify([filePath]))}`;
}

function createCommandUri(commandId: string): string {
  return `command:${commandId}`;
}

function formatSeverity(severity: DiagnosticMessage["severity"]): string {
  if (severity === undefined) {
    return "Warning";
  }

  return `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
}

const THEME_MANAGER_STYLES = `
.mh-theme-manager {
  box-sizing: border-box;
  padding: 12px;
  color: var(--vscode-foreground);
  font: var(--vscode-font-size) var(--vscode-font-family);
}

.mh-section + .mh-section {
  margin-top: 16px;
}

.mh-section h2 {
  margin: 0 0 8px;
  font-size: 1em;
  font-weight: 600;
}

.mh-section h3 {
  margin: 10px 0 6px;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--vscode-descriptionForeground);
}

.mh-definition-list {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 10px;
  margin: 0;
}

.mh-definition-list dt {
  color: var(--vscode-descriptionForeground);
}

.mh-definition-list dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.mh-empty,
.mh-meta,
.mh-fallback,
.mh-diagnostic p {
  margin: 0;
}

.mh-file-list {
  display: grid;
  gap: 4px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.mh-file-list a {
  color: var(--vscode-textLink-foreground);
  overflow-wrap: anywhere;
  text-decoration: none;
}

.mh-file-list a:hover {
  color: var(--vscode-textLink-activeForeground);
  text-decoration: underline;
}

.mh-empty,
.mh-meta {
  color: var(--vscode-descriptionForeground);
}

.mh-fallback {
  margin-top: 8px;
  color: var(--vscode-editorWarning-foreground);
}

.mh-diagnostic-list {
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 0;
  list-style: none;
}

.mh-diagnostic {
  padding: 8px;
  border-left: 3px solid var(--vscode-editorWarning-foreground);
  background: var(--vscode-editorWidget-background);
}

.mh-diagnostic--error {
  border-left-color: var(--vscode-editorError-foreground);
}

.mh-diagnostic--info {
  border-left-color: var(--vscode-editorInfo-foreground);
}

.mh-diagnostic-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  color: var(--vscode-descriptionForeground);
  font-size: 0.9em;
}
`;
