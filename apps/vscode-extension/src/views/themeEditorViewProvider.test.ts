import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";
import { DiagnosticsService } from "../services/diagnosticsService.js";
import { DocumentStateService } from "../services/documentStateService.js";
import { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { ThemeEditorViewProvider } from "./themeEditorViewProvider.js";

describe("ThemeEditorViewProvider", () => {
  it("rerenders diagnostics from document state updates", () => {
    const documentStateService = new DocumentStateService();
    const diagnosticsService = new DiagnosticsService();
    const provider = new ThemeEditorViewProvider(
      documentStateService,
      diagnosticsService,
      new WorkspaceTrustService(() => true),
    );
    const view = {
      webview: {
        cspSource: "vscode-resource:",
        html: "",
        options: {},
      },
    } as vscode.WebviewView;

    provider.resolveWebviewView(view);
    expect(view.webview.html).toContain("Diagnostics: 0");

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [
        {
          message: "Template p is missing.",
          severity: "warning",
          source: "theme",
        },
      ],
      html: "<h1>Title</h1>",
      resolvedThemeId: "default",
    });

    expect(diagnosticsService.getDiagnostics()).toEqual([
      {
        message: "Template p is missing.",
        source: "theme",
      },
    ]);
    expect(view.webview.html).toContain("Diagnostics: 1");

    provider.dispose();
  });
});
