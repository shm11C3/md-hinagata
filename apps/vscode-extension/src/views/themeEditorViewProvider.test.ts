import { describe, expect, it } from "vitest";
import type * as vscode from "vscode";
import { COMMAND_IDS } from "../commands/commandIds.js";
import { DiagnosticsService } from "../services/diagnosticsService.js";
import { DocumentStateService } from "../services/documentStateService.js";
import { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { ThemeEditorViewProvider } from "./themeEditorViewProvider.js";

describe("ThemeEditorViewProvider", () => {
  it("renders active document state and diagnostics from document state updates", () => {
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
    expect(view.webview.options).toMatchObject({
      enableCommandUris: [
        COMMAND_IDS.createThemeFromDefault,
        COMMAND_IDS.openThemeFile,
      ],
      enableScripts: false,
      localResourceRoots: [],
    });
    expect(view.webview.html).toContain("No active Markdown document.");
    expect(view.webview.html).toContain("Create Theme from Default");
    expect(view.webview.html).toContain(
      "command:md-hinagata.createThemeFromDefault",
    );
    expect(view.webview.html).toContain("No resolved theme files.");
    expect(view.webview.html).toContain("No issues");

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult(
      {
        css: ".basic-heading { color: red; }",
        diagnostics: [
          {
            code: "template-render",
            message: "Template p is missing.",
            severity: "error",
            source: "template",
          },
        ],
        frontmatter: {
          output: "fragment",
          theme: "basic",
        },
        html: "<h1>Title</h1>",
        resolvedCssMode: "style-tag",
        resolvedThemeId: "default",
      },
      {
        themeFiles: [
          {
            kind: "manifest",
            label: "theme.json",
            path: "/themes/default/theme.json",
          },
          {
            kind: "stylesheet",
            label: "styles.css",
            path: "/themes/default/styles.css",
          },
          {
            kind: "template",
            label: "h1.hbs",
            path: "/themes/default/templates/h1.hbs",
            templateKey: "h1",
          },
        ],
      },
    );

    expect(diagnosticsService.getDiagnostics()).toEqual([
      {
        message: "template-render: Template p is missing.",
        severity: "error",
        source: "transform",
      },
    ]);
    expect(view.webview.html).toContain("Current Document");
    expect(view.webview.html).toContain("<dt>Theme</dt><dd>basic</dd>");
    expect(view.webview.html).toContain(
      "<dt>Resolved Theme</dt><dd>default</dd>",
    );
    expect(view.webview.html).toContain("<dt>Output</dt><dd>fragment</dd>");
    expect(view.webview.html).toContain(
      "<dt>CSS Output Mode</dt><dd>style-tag</dd>",
    );
    expect(view.webview.html).toContain(
      "<dt>Generated HTML</dt><dd>fragment with style tag</dd>",
    );
    expect(view.webview.html).toContain("Fallback: basic -> default");
    expect(view.webview.html).toContain("Theme Files");
    expect(view.webview.html).toContain("theme.json");
    expect(view.webview.html).toContain("styles.css");
    expect(view.webview.html).toContain("Templates");
    expect(view.webview.html).toContain("h1: h1.hbs");
    expect(view.webview.html).toContain(
      "command:md-hinagata.openThemeFile?%5B%22%2Fthemes%2Fdefault%2Ftheme.json%22%5D",
    );
    expect(view.webview.html).toContain("Diagnostics");
    expect(view.webview.html).toContain("Error");
    expect(view.webview.html).toContain(
      "template-render: Template p is missing.",
    );

    provider.dispose();
  });

  it("renders warning diagnostics when severity is not provided", () => {
    const documentStateService = new DocumentStateService();
    const diagnosticsService = new DiagnosticsService();
    const provider = new ThemeEditorViewProvider(
      documentStateService,
      diagnosticsService,
      new WorkspaceTrustService(() => false),
    );
    const view = {
      webview: {
        cspSource: "vscode-resource:",
        html: "",
        options: {},
      },
    } as vscode.WebviewView;

    provider.resolveWebviewView(view);
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult(
      {
        diagnostics: [],
        html: "<h1>Title</h1>",
        resolvedCssMode: "style-tag",
        resolvedThemeId: "default",
      },
      {
        diagnostics: [
          {
            message: "Bundled theme 'basic' is missing theme.json.",
            source: "theme",
          },
        ],
      },
    );

    expect(view.webview.html).toContain("Warning");
    expect(view.webview.html).toContain("theme");
    expect(view.webview.html).toContain(
      "Bundled theme &#39;basic&#39; is missing theme.json.",
    );
    expect(view.webview.html).toContain(
      "<dt>Workspace trust</dt><dd>untrusted</dd>",
    );

    provider.dispose();
  });

  it("renders invalid requested css output mode with resolved fallback", () => {
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
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "---\nhinagata:\n  cssMode: unsupported\n---\n# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [
        {
          code: "unsupported-css-mode",
          message:
            "Unsupported hinagata.cssMode 'unsupported'; falling back to 'style-tag'.",
          severity: "warning",
          source: "frontmatter",
        },
      ],
      frontmatter: {
        cssMode: "unsupported",
      },
      html: "<h1>Title</h1>",
      resolvedCssMode: "style-tag",
      resolvedThemeId: "default",
    });

    expect(view.webview.html).toContain(
      "<dt>CSS Output Mode</dt><dd>unsupported -&gt; style-tag</dd>",
    );
    expect(view.webview.html).toContain(
      "<dt>Generated HTML</dt><dd>fragment with style tag</dd>",
    );
    expect(view.webview.html).toContain("unsupported-css-mode");
    expect(view.webview.html).toContain(
      "Unsupported hinagata.cssMode &#39;unsupported&#39;; falling back to &#39;style-tag&#39;.",
    );

    provider.dispose();
  });
});
