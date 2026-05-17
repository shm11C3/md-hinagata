import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";
import { DocumentStateService } from "../services/documentStateService.js";
import {
  PREVIEW_PANEL_TITLE,
  PreviewPanel,
  type PreviewWebviewPanel,
} from "./previewPanel.js";

describe("PreviewPanel", () => {
  it("creates a reusable webview panel with rendered placeholder HTML", () => {
    const documentStateService = new DocumentStateService();
    const panels: PreviewWebviewPanel[] = [];
    let revealCount = 0;
    let disposeCount = 0;
    let disposeListener: (() => void) | undefined;
    const previewPanel = new PreviewPanel(documentStateService, {
      createPanel: () => {
        const panel: PreviewWebviewPanel = {
          dispose: () => {
            disposeCount += 1;
            disposeListener?.();
          },
          onDidDispose: (listener) => {
            disposeListener = listener;
            return { dispose: () => {} };
          },
          reveal: () => {
            revealCount += 1;
          },
          webview: {
            asWebviewUri: (_uri: vscode.Uri) =>
              ({
                toString: () => "vscode-resource:/preview/styles.css",
              }) as vscode.Uri,
            cspSource: "vscode-resource:",
            html: "",
          },
        };
        panels.push(panel);
        return panel;
      },
      resolveStylesheetUri: (webview) =>
        webview.asWebviewUri({} as vscode.Uri).toString(),
      revealPanel: (panel) => {
        panel.reveal();
      },
    });

    previewPanel.show();
    previewPanel.show();

    expect(panels).toHaveLength(1);
    expect(revealCount).toBe(2);
    expect(panels[0]?.webview.html).toContain(PREVIEW_PANEL_TITLE);
    expect(panels[0]?.webview.html).toContain("Preview will render here.");
    expect(panels[0]?.webview.html).toContain(
      '<link rel="stylesheet" href="vscode-resource:/preview/styles.css">',
    );
    expect(panels[0]?.webview.html).toContain(
      'Content-Security-Policy" content="default-src',
    );

    expect(previewPanel.isVisible).toBe(true);
    previewPanel.dispose();
    expect(disposeCount).toBe(1);
    expect(previewPanel.isVisible).toBe(false);
  });

  it("rerenders visible preview content when document state changes", () => {
    const documentStateService = new DocumentStateService();
    const panel = createPreviewWebviewPanel();
    const previewPanel = new PreviewPanel(documentStateService, {
      createPanel: () => panel,
      resolveStylesheetUri: (webview) =>
        webview.asWebviewUri({} as vscode.Uri).toString(),
      revealPanel: (targetPanel) => {
        targetPanel.reveal();
      },
    });

    previewPanel.show();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      css: ".article { color: red; }",
      diagnostics: [],
      html: "<h1>Title</h1>",
      resolvedThemeId: "default",
    });

    expect(panel.webview.html).toContain("<h1>Title</h1>");
    expect(panel.webview.html).toContain(".article { color: red; }");
  });
});

function createPreviewWebviewPanel(): PreviewWebviewPanel {
  return {
    dispose: () => {},
    onDidDispose: () => ({ dispose: () => {} }),
    reveal: () => {},
    webview: {
      asWebviewUri: (_uri: vscode.Uri) =>
        ({
          toString: () => "vscode-resource:/preview/styles.css",
        }) as vscode.Uri,
      cspSource: "vscode-resource:",
      html: "",
    },
  };
}
