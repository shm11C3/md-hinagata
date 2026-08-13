import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
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
    expect(panels[0]?.webview.html).not.toContain('<link rel="stylesheet"');
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
      html: [
        "<style>",
        ".article { color: red; }",
        "</style>",
        '<main class="mh-document">',
        "<h1>Title</h1>",
        '<p style="color: red;">Styled</p>',
        "</main>",
      ].join("\n"),
      resolvedCssMode: "style-tag",
      resolvedLineBreakMode: "markdown",
      resolvedThemeId: "default",
    });

    expect(panel.webview.html).toContain("<h1>Title</h1>");
    expect(panel.webview.html).toContain('<p style="color: red;">Styled</p>');
    expect(panel.webview.html).toContain(".article { color: red; }");
    expect(
      panel.webview.html.match(/\.article \{ color: red; \}/g),
    ).toHaveLength(1);
    expect(panel.webview.html).toContain("style-src-attr 'unsafe-inline'");
  });

  it("renders an active empty transform result without the placeholder", () => {
    const documentStateService = new DocumentStateService();
    const panel = createPreviewWebviewPanel();
    const previewPanel = new PreviewPanel(documentStateService, {
      createPanel: () => panel,
      revealPanel: (targetPanel) => {
        targetPanel.reveal();
      },
    });

    previewPanel.show();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "",
      resolvedCssMode: "style-tag",
      resolvedLineBreakMode: "markdown",
      resolvedThemeId: "default",
    });

    expect(panel.webview.html).toContain("<body></body>");
    expect(panel.webview.html).not.toContain("Preview will render here.");
  });

  it("renders the basic example fragment and theme CSS in the preview webview", () => {
    const documentStateService = new DocumentStateService();
    const panel = createPreviewWebviewPanel();
    const previewPanel = new PreviewPanel(documentStateService, {
      createPanel: () => panel,
      revealPanel: (targetPanel) => {
        targetPanel.reveal();
      },
    });
    const markdown = readBasicExampleFile("sample.md");
    const expectedHtml = readBasicExampleFile("expected.html").trimEnd();
    const themeCss = readBasicExampleFile(
      ".md-hinagata/themes/basic/styles.css",
    );

    previewPanel.show();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown,
      uri: "file:///examples/basic/sample.md",
    });
    documentStateService.applyTransformResult({
      css: themeCss,
      diagnostics: [],
      frontmatter: {
        output: "fragment",
        theme: "basic",
      },
      html: expectedHtml,
      resolvedCssMode: "style-tag",
      resolvedLineBreakMode: "markdown",
      resolvedThemeId: "basic",
    });

    expect(panel.webview.html).toContain(expectedHtml);
    expect(panel.webview.html).toContain(".basic-heading");
    expect(panel.webview.html).not.toContain('<main class="mh-preview">');
    expect(panel.webview.html).toContain(
      'Content-Security-Policy" content="default-src',
    );
    expect(panel.webview.html).not.toContain("Preview will render here.");
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

function readBasicExampleFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(
      new URL(`../../../../examples/basic/${relativePath}`, import.meta.url),
    ),
    "utf8",
  );
}
