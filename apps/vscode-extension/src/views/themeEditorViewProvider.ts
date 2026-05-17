import type * as vscode from "vscode";

import type { DiagnosticsService } from "../services/diagnosticsService.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { createWebviewHtml } from "../utils/webviewHtml.js";

export const THEME_MANAGER_VIEW_ID = "mdHinagata.themeManager";

export class ThemeEditorViewProvider implements vscode.WebviewViewProvider {
  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly workspaceTrustService: WorkspaceTrustService,
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: false,
    };
    webviewView.webview.html = createWebviewHtml(
      "Theme Manager",
      [
        `<p>Theme: ${this.documentStateService.getCurrentTheme()}</p>`,
        `<p>Workspace trust: ${this.workspaceTrustService.isTrusted ? "trusted" : "untrusted"}</p>`,
        `<p>Diagnostics: ${this.diagnosticsService.getDiagnostics().length}</p>`,
      ].join(""),
    );
  }
}
