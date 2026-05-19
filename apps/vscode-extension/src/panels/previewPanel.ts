import type * as vscode from "vscode";

import type { DocumentStateService } from "../services/documentStateService.js";
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
}

export class PreviewPanel {
  readonly #documentStateSubscription: vscode.Disposable;
  #panel: PreviewWebviewPanel | undefined;

  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly host: PreviewPanelHost,
  ) {
    this.#documentStateSubscription = this.documentStateService.subscribe(
      () => {
        this.render();
      },
    );
  }

  public get isVisible(): boolean {
    return this.#panel !== undefined;
  }

  public show(): void {
    const panel = this.getOrCreatePanel();
    this.render();
    this.host.revealPanel(panel);
  }

  public dispose(): void {
    this.#documentStateSubscription.dispose();
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

  private render(): void {
    const panel = this.#panel;
    if (panel === undefined) {
      return;
    }

    const state = this.documentStateService.getState();
    const bodyHtml =
      state.status === "active"
        ? state.generatedHtml
        : `<main class="mh-preview-placeholder"><p>${escapeHtml("Preview will render here.")}</p></main>`;

    panel.webview.html = createWebviewHtml({
      bodyHtml,
      cspSource: panel.webview.cspSource,
      title: PREVIEW_PANEL_TITLE,
    });
  }
}
