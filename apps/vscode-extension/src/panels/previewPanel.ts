import type * as vscode from "vscode";

import type { DocumentStateService } from "../services/documentStateService.js";
import type { TransformService } from "../services/transformService.js";
import { createWebviewHtml, escapeHtml } from "../utils/webviewHtml.js";

export const PREVIEW_PANEL_VIEW_TYPE = "md-hinagata.preview";
export const PREVIEW_PANEL_TITLE = "md-hinagata Preview";

export interface PreviewWebview {
  asWebviewUri(uri: vscode.Uri): vscode.Uri;
  cspSource: string;
  html: string;
}

export interface PreviewWebviewPanel {
  webview: PreviewWebview;
  dispose(): void;
  onDidDispose(listener: () => void): vscode.Disposable;
  reveal(column?: vscode.ViewColumn): void;
}

export interface PreviewPanelHost {
  createPanel(): PreviewWebviewPanel;
  revealPanel(panel: PreviewWebviewPanel): void;
  resolveStylesheetUri(webview: PreviewWebview): string;
}

export class PreviewPanel {
  #panel: PreviewWebviewPanel | undefined;

  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly transformService: TransformService,
    private readonly host: PreviewPanelHost,
  ) {}

  public get isVisible(): boolean {
    return this.#panel !== undefined;
  }

  public show(markdown: string): void {
    const panel = this.getOrCreatePanel();
    const result = this.transformService.transform(markdown);
    this.documentStateService.setGeneratedHtml(result.html);
    panel.webview.html = createWebviewHtml({
      bodyHtml: [
        '<main class="mh-preview">',
        result.html.length > 0
          ? result.html
          : `<p>${escapeHtml("Preview will render here.")}</p>`,
        "</main>",
      ].join(""),
      cspSource: panel.webview.cspSource,
      stylesheets: [this.host.resolveStylesheetUri(panel.webview)],
      title: PREVIEW_PANEL_TITLE,
    });
    this.host.revealPanel(panel);
  }

  public dispose(): void {
    this.#panel?.dispose();
    this.#panel = undefined;
  }

  private getOrCreatePanel(): PreviewWebviewPanel {
    if (this.#panel !== undefined) {
      return this.#panel;
    }

    const panel = this.host.createPanel();
    panel.onDidDispose(() => {
      this.#panel = undefined;
    });
    this.#panel = panel;
    return panel;
  }
}
