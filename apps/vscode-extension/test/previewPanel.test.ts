import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";

import {
  PREVIEW_PANEL_TITLE,
  PreviewPanel,
  type PreviewWebviewPanel,
} from "../src/panels/previewPanel.js";
import { DocumentStateService } from "../src/services/documentStateService.js";
import { TransformService } from "../src/services/transformService.js";

describe("PreviewPanel", () => {
  it("creates a reusable webview panel with rendered placeholder HTML", () => {
    const documentStateService = new DocumentStateService();
    const transformService = new TransformService();
    const panels: PreviewWebviewPanel[] = [];
    let revealCount = 0;
    let disposeListener: (() => void) | undefined;
    const previewPanel = new PreviewPanel(
      documentStateService,
      transformService,
      {
        createPanel: () => {
          const panel: PreviewWebviewPanel = {
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
      },
    );

    previewPanel.show("");
    previewPanel.show("");

    expect(panels).toHaveLength(1);
    expect(revealCount).toBe(2);
    expect(documentStateService.getGeneratedHtml()).toBe("");
    expect(panels[0]?.webview.html).toContain(PREVIEW_PANEL_TITLE);
    expect(panels[0]?.webview.html).toContain("Preview will render here.");
    expect(panels[0]?.webview.html).toContain(
      '<link rel="stylesheet" href="vscode-resource:/preview/styles.css">',
    );
    expect(panels[0]?.webview.html).toContain(
      'Content-Security-Policy" content="default-src',
    );

    expect(previewPanel.isVisible).toBe(true);
    disposeListener?.();
    expect(previewPanel.isVisible).toBe(false);
  });
});
