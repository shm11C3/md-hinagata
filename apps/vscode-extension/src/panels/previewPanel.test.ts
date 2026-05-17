import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";
import { DocumentStateService } from "../services/documentStateService.js";
import {
  PREVIEW_PANEL_TITLE,
  PreviewPanel,
  type PreviewTransformService,
  type PreviewWebviewPanel,
} from "./previewPanel.js";

describe("PreviewPanel", () => {
  it("creates a reusable webview panel with rendered placeholder HTML", async () => {
    const documentStateService = new DocumentStateService();
    const transformService: PreviewTransformService = {
      transform: async (markdown) => ({
        diagnostics: [],
        html: markdown,
        resolvedThemeId: "default",
      }),
    };
    const panels: PreviewWebviewPanel[] = [];
    let revealCount = 0;
    let disposeCount = 0;
    let disposeListener: (() => void) | undefined;
    const previewPanel = new PreviewPanel(
      documentStateService,
      transformService,
      {
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
      },
    );

    await previewPanel.show("");
    await previewPanel.show("");

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
    previewPanel.dispose();
    expect(disposeCount).toBe(1);
    expect(previewPanel.isVisible).toBe(false);
  });

  it("ignores stale preview transform completions", async () => {
    const documentStateService = new DocumentStateService();
    const completions: Array<() => void> = [];
    const transformService: PreviewTransformService = {
      transform: (markdown) =>
        new Promise((resolve) => {
          completions.push(() => {
            resolve({
              diagnostics: [],
              html: `<p>${markdown}</p>`,
              resolvedThemeId: "default",
            });
          });
        }),
    };
    let revealCount = 0;
    const panel: PreviewWebviewPanel = {
      dispose: () => {},
      onDidDispose: () => ({ dispose: () => {} }),
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
    const previewPanel = new PreviewPanel(
      documentStateService,
      transformService,
      {
        createPanel: () => panel,
        resolveStylesheetUri: (webview) =>
          webview.asWebviewUri({} as vscode.Uri).toString(),
        revealPanel: (targetPanel) => {
          targetPanel.reveal();
        },
      },
    );

    const firstShow = previewPanel.show("first");
    const secondShow = previewPanel.show("second");

    completions[1]?.();
    await secondShow;
    expect(documentStateService.getGeneratedHtml()).toBe("<p>second</p>");
    expect(panel.webview.html).toContain("<p>second</p>");
    expect(revealCount).toBe(1);

    completions[0]?.();
    await firstShow;
    expect(documentStateService.getGeneratedHtml()).toBe("<p>second</p>");
    expect(panel.webview.html).toContain("<p>second</p>");
    expect(panel.webview.html).not.toContain("<p>first</p>");
    expect(revealCount).toBe(1);
  });
});
