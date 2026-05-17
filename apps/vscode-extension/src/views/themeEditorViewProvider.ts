import type * as vscode from "vscode";

import type { DiagnosticsService } from "../services/diagnosticsService.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { createWebviewHtml, escapeHtml } from "../utils/webviewHtml.js";

export const THEME_MANAGER_VIEW_ID = "md-hinagata.themeManager";

export class ThemeEditorViewProvider implements vscode.WebviewViewProvider {
  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly workspaceTrustService: WorkspaceTrustService,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: false,
      localResourceRoots: [],
    };
    webviewView.webview.html = createWebviewHtml({
      bodyHtml: [
        `<p>Theme: ${escapeHtml(this.documentStateService.getCurrentTheme())}</p>`,
        `<p>Workspace trust: ${escapeHtml(this.workspaceTrustService.isTrusted ? "trusted" : "untrusted")}</p>`,
        `<p>Diagnostics: ${escapeHtml(String(this.diagnosticsService.getDiagnostics().length))}</p>`,
      ].join(""),
      cspSource: webviewView.webview.cspSource,
      title: "Theme Manager",
    });
  }
}
