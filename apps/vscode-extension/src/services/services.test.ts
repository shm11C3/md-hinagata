import { describe, expect, it } from "vitest";

import type { DiagnosticMessage } from "./diagnosticsService.js";
import { DiagnosticsService } from "./diagnosticsService.js";
import {
  createActiveDocumentSnapshot,
  DocumentStateService,
} from "./documentStateService.js";
import { DocumentTransformService } from "./documentTransformService.js";
import {
  type TransformRequest,
  type TransformResponse,
  TransformService,
  type WasmTransformModuleLoader,
} from "./transformService.js";
import { WorkspaceTrustService } from "./workspaceTrustService.js";

describe("extension services", () => {
  it("returns defensive diagnostic snapshots", () => {
    const diagnosticsService = new DiagnosticsService();
    const diagnostic: DiagnosticMessage = {
      message: "Initial warning",
      source: "extension",
    };

    diagnosticsService.replaceDiagnostics([diagnostic]);
    diagnostic.message = "Mutated warning";

    const diagnostics = diagnosticsService.getDiagnostics();
    expect(diagnostics).toEqual([
      {
        message: "Initial warning",
        source: "extension",
      },
    ]);

    (diagnostics as DiagnosticMessage[])[0] = {
      message: "Changed by caller",
      source: "theme",
    };

    expect(diagnosticsService.getDiagnostics()).toEqual([
      {
        message: "Initial warning",
        source: "extension",
      },
    ]);
  });

  it("reads workspace trust dynamically", () => {
    let isTrusted = false;
    const workspaceTrustService = new WorkspaceTrustService(() => isTrusted);

    expect(workspaceTrustService.isTrusted).toBe(false);

    isTrusted = true;
    expect(workspaceTrustService.isTrusted).toBe(true);
  });

  it("tracks active Markdown document state and inactive documents", () => {
    const documentStateService = new DocumentStateService();
    const observedStates: string[] = [];
    documentStateService.subscribe((state) => {
      observedStates.push(state.status);
    });

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });

    expect(documentStateService.getState()).toMatchObject({
      generatedHtml: "",
      isStale: true,
      markdown: "# Title",
      status: "active",
      uri: "file:///article.md",
    });

    documentStateService.setActiveDocument({
      languageId: "plaintext",
      markdown: "not markdown",
      uri: "file:///notes.txt",
    });

    expect(documentStateService.getState()).toMatchObject({
      currentTheme: "default",
      generatedHtml: "",
      isStale: false,
      status: "inactive",
    });
    expect(observedStates).toEqual(["active", "inactive"]);
  });

  it("clears transform metadata when switching active Markdown documents", () => {
    const documentStateService = new DocumentStateService();

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# First",
      uri: "file:///first.md",
    });
    documentStateService.applyTransformResult(
      {
        css: ".first {}",
        diagnostics: [],
        frontmatter: {
          theme: "basic",
        },
        html: "<h1>First</h1>",
        resolvedCssMode: "style-tag",
        resolvedLineBreakMode: "markdown",
        resolvedThemeId: "basic",
      },
      {
        transformedAt: 100,
      },
    );

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Second",
      uri: "file:///second.md",
    });

    const state = documentStateService.getState();
    expect(state).toMatchObject({
      currentThemeFiles: [],
      diagnostics: [],
      generatedHtml: "",
      isStale: true,
      markdown: "# Second",
      status: "active",
      uri: "file:///second.md",
    });
    expect(state.css).toBeUndefined();
    expect(state.frontmatter).toBeUndefined();
    expect(state.lastTransformedAt).toBeUndefined();
    expect(state.resolvedCssMode).toBeUndefined();
    expect(state.resolvedThemeId).toBeUndefined();
  });

  it("gives each document state listener its own snapshot", () => {
    const documentStateService = new DocumentStateService();
    let secondListenerGeneratedHtml: string | undefined;

    documentStateService.subscribe((state) => {
      state.generatedHtml = "changed by first listener";
    });
    documentStateService.subscribe((state) => {
      secondListenerGeneratedHtml = state.generatedHtml;
    });

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });

    expect(secondListenerGeneratedHtml).toBe("");
  });

  it("creates active document snapshots from text documents", () => {
    expect(
      createActiveDocumentSnapshot({
        getText: () => "# Title",
        languageId: "markdown",
        uri: {
          toString: () => "file:///article.md",
        },
      }),
    ).toEqual({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
  });

  it("applies transform results as defensive document state snapshots", () => {
    const documentStateService = new DocumentStateService();
    const diagnostics: DiagnosticMessage[] = [
      {
        message: "Theme warning",
        source: "theme",
      },
    ];

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult(
      {
        css: ".article {}",
        diagnostics: [
          {
            code: "missing-template",
            message: "Template p is missing.",
            severity: "warning",
            source: "template",
          },
        ],
        frontmatter: {
          output: "fragment",
          theme: "basic",
        },
        html: "<h1>Title</h1>",
        resolvedCssMode: "style-tag",
        resolvedLineBreakMode: "markdown",
        resolvedThemeId: "basic",
      },
      {
        diagnostics,
        themeFiles: [
          {
            kind: "template",
            label: "h1.hbs",
            path: "/theme/templates/h1.hbs",
            templateKey: "h1",
          },
        ],
        transformedAt: 100,
      },
    );
    diagnostics[0] = {
      message: "mutated",
      source: "extension",
    };

    const state = documentStateService.getState();
    expect(state).toMatchObject({
      css: ".article {}",
      currentTheme: "basic",
      generatedHtml: "<h1>Title</h1>",
      isStale: false,
      resolvedCssMode: "style-tag",
      resolvedLineBreakMode: "markdown",
      lastTransformedAt: 100,
      resolvedThemeId: "basic",
    });
    expect(state.diagnostics).toEqual([
      {
        message: "Theme warning",
        source: "theme",
      },
      {
        message: "missing-template: Template p is missing.",
        severity: "warning",
        source: "transform",
      },
    ]);
    expect(state.currentThemeFiles).toEqual([
      {
        kind: "template",
        label: "h1.hbs",
        path: "/theme/templates/h1.hbs",
        templateKey: "h1",
      },
    ]);

    (state.diagnostics as DiagnosticMessage[])[0] = {
      message: "changed by caller",
      source: "extension",
    };
    expect(documentStateService.getState().diagnostics[0]).toEqual({
      message: "Theme warning",
      source: "theme",
    });
  });

  it("ignores transform results for a stale active document uri", () => {
    const documentStateService = new DocumentStateService();
    const observedHtml: string[] = [];
    documentStateService.subscribe((state) => {
      observedHtml.push(state.generatedHtml);
    });

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# First",
      uri: "file:///first.md",
    });
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Second",
      uri: "file:///second.md",
    });

    const state = documentStateService.applyTransformResult(
      {
        diagnostics: [],
        html: "<h1>First</h1>",
        resolvedCssMode: "style-tag",
        resolvedLineBreakMode: "markdown",
        resolvedThemeId: "default",
      },
      {
        expectedUri: "file:///first.md",
      },
    );

    expect(state).toMatchObject({
      generatedHtml: "",
      isStale: true,
      markdown: "# Second",
      uri: "file:///second.md",
    });
    expect(observedHtml).toEqual(["", ""]);
  });

  it("refreshes active documents with resolved theme packages", async () => {
    const documentStateService = new DocumentStateService();
    const resolvedThemeFiles = [
      {
        kind: "stylesheet" as const,
        label: "styles.css",
        path: "/themes/workspace/styles.css",
      },
    ];
    const resolvedThemes = {
      default: {
        diagnostics: [],
        theme: {
          files: [],
          rootPath: "/themes/default",
          source: "bundled" as const,
          themePackage: {
            css: ".default {}",
            id: "default",
            name: "Default",
            templates: {},
            version: "0.1.0",
          },
        },
      },
      workspace: {
        diagnostics: [],
        theme: {
          files: resolvedThemeFiles,
          rootPath: "/themes/workspace",
          source: "workspace" as const,
          themePackage: {
            css: ".workspace {}",
            id: "workspace",
            name: "Workspace",
            templates: {},
            version: "0.1.0",
          },
        },
      },
    };
    const resolvedThemeIds: string[] = [];
    const transformRequests: TransformRequest[] = [];
    const documentTransformService = new DocumentTransformService(
      documentStateService,
      {
        resolveTheme: async (themeId) => {
          resolvedThemeIds.push(themeId);
          return resolvedThemes[themeId as keyof typeof resolvedThemes];
        },
      },
      {
        transform: async (request) => {
          transformRequests.push(request);
          return transformRequests.length === 1
            ? {
                diagnostics: [],
                frontmatter: {
                  theme: "workspace",
                },
                html: "<p>Default</p>",
                resolvedCssMode: "style-tag",
                resolvedLineBreakMode: "markdown",
                resolvedThemeId: "default",
              }
            : {
                css: ".workspace {}",
                diagnostics: [],
                frontmatter: {
                  theme: "workspace",
                },
                html: "<p>Workspace</p>",
                resolvedCssMode: "style-tag",
                resolvedLineBreakMode: "markdown",
                resolvedThemeId: "workspace",
              };
        },
      },
      new WorkspaceTrustService(() => true),
    );

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "---\nhinagata:\n  theme: workspace\n---\n# Title",
      uri: "file:///article.md",
    });

    const state = await documentTransformService.refreshActiveDocument();

    expect(resolvedThemeIds).toEqual(["default", "workspace"]);
    expect(
      transformRequests.map((request) =>
        request.themes.map((theme) => theme.id),
      ),
    ).toEqual([["default"], ["workspace", "default"]]);
    expect(state).toMatchObject({
      css: ".workspace {}",
      currentTheme: "workspace",
      currentThemeFiles: resolvedThemeFiles,
      generatedHtml: "<p>Workspace</p>",
      isStale: false,
      resolvedThemeId: "workspace",
    });
  });

  it("resolves the default theme for documents without hinagata.theme regardless of history", async () => {
    const documentStateService = new DocumentStateService();
    const themePackages: Record<
      string,
      {
        id: string;
        name: string;
        templates: Record<string, never>;
        version: string;
      }
    > = {
      "theme-a": {
        id: "theme-a",
        name: "Theme A",
        templates: {},
        version: "0.1.0",
      },
      "theme-b": {
        id: "theme-b",
        name: "Theme B",
        templates: {},
        version: "0.1.0",
      },
      default: {
        id: "default",
        name: "Default",
        templates: {},
        version: "0.1.0",
      },
    };
    const readFrontmatterTheme = (markdown: string): string | undefined =>
      /theme:\s*(\S+)/.exec(markdown)?.[1];
    const requestedDefaultThemeIds: string[] = [];
    const documentTransformService = new DocumentTransformService(
      documentStateService,
      {
        resolveTheme: async (themeId) => ({
          diagnostics: [],
          theme: {
            files: [],
            rootPath: `/themes/${themeId}`,
            source: themeId === "default" ? "bundled" : "workspace",
            themePackage: themePackages[themeId] ?? themePackages.default,
          },
        }),
      },
      {
        transform: async (request) => {
          requestedDefaultThemeIds.push(request.defaultThemeId ?? "");
          const frontmatterTheme = readFrontmatterTheme(request.markdown);
          const availableThemeIds = new Set(
            request.themes.map((theme) => theme.id),
          );
          const resolvedThemeId =
            frontmatterTheme !== undefined &&
            availableThemeIds.has(frontmatterTheme)
              ? frontmatterTheme
              : (request.defaultThemeId ?? "default");
          return {
            diagnostics: [],
            frontmatter:
              frontmatterTheme === undefined ? {} : { theme: frontmatterTheme },
            html: `<p>${resolvedThemeId}</p>`,
            resolvedCssMode: "style-tag",
            resolvedLineBreakMode: "markdown",
            resolvedThemeId,
          };
        },
      },
      new WorkspaceTrustService(() => true),
    );

    const refreshWith = async (
      markdown: string,
      uri: string,
    ): Promise<string | undefined> => {
      documentStateService.setActiveDocument({
        languageId: "markdown",
        markdown,
        uri,
      });
      const state = await documentTransformService.refreshActiveDocument();
      return state.resolvedThemeId;
    };

    const themedA = await refreshWith(
      "---\nhinagata:\n  theme: theme-a\n---\n# A",
      "file:///a.md",
    );
    expect(themedA).toBe("theme-a");

    const themeless1 = await refreshWith("# C", "file:///c.md");
    expect(themeless1).toBe("default");

    const themedB = await refreshWith(
      "---\nhinagata:\n  theme: theme-b\n---\n# B",
      "file:///b.md",
    );
    expect(themedB).toBe("theme-b");

    const themeless2 = await refreshWith("# C", "file:///c.md");
    expect(themeless2).toBe("default");

    // The fallback theme passed to every transform stays the bundled default,
    // so theme-less documents never inherit the previously active theme.
    expect(requestedDefaultThemeIds.length).toBeGreaterThan(0);
    expect(
      requestedDefaultThemeIds.every((themeId) => themeId === "default"),
    ).toBe(true);
  });

  it("does not apply a refresh result after the active document changes", async () => {
    const documentStateService = new DocumentStateService();
    let completeTransform: ((response: TransformResponse) => void) | undefined;
    let markTransformStarted = (): void => {};
    const transformStarted = new Promise<void>((resolve) => {
      markTransformStarted = resolve;
    });
    const documentTransformService = new DocumentTransformService(
      documentStateService,
      {
        resolveTheme: async () => ({
          diagnostics: [],
          theme: {
            files: [],
            rootPath: "/themes/default",
            source: "bundled",
            themePackage: {
              id: "default",
              name: "Default",
              templates: {},
              version: "0.1.0",
            },
          },
        }),
      },
      {
        transform: () =>
          new Promise((resolve) => {
            completeTransform = resolve;
            markTransformStarted();
          }),
      },
      new WorkspaceTrustService(() => true),
    );

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# First",
      uri: "file:///first.md",
    });
    const refresh = documentTransformService.refreshActiveDocument();
    await transformStarted;
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Second",
      uri: "file:///second.md",
    });
    completeTransform?.({
      diagnostics: [],
      html: "<h1>First</h1>",
      resolvedCssMode: "style-tag",
      resolvedLineBreakMode: "markdown",
      resolvedThemeId: "default",
    });

    const state = await refresh;

    expect(state).toMatchObject({
      generatedHtml: "",
      isStale: true,
      markdown: "# Second",
      uri: "file:///second.md",
    });
  });

  it("passes transform requests to the loaded WASM module", async () => {
    let loadCount = 0;
    const loadModule: WasmTransformModuleLoader = async () => {
      loadCount += 1;
      return {
        transformMarkdownJson: (request) => ({
          diagnostics: [],
          html: `<p>${request.markdown}</p>`,
          resolvedCssMode: "style-tag",
          resolvedLineBreakMode: "markdown",
          resolvedThemeId: request.defaultThemeId ?? "",
        }),
      };
    };
    const transformService = new TransformService(loadModule);

    const response = await transformService.transform({
      defaultThemeId: "default",
      markdown: "Hello",
      options: { allowRawHtml: false },
      themes: [
        {
          id: "default",
          name: "Default",
          templates: {},
          version: "0.1.0",
        },
      ],
    });
    await transformService.transform("Again");

    expect(response.html).toBe("<p>Hello</p>");
    expect(transformService.getLatestResult()?.html).toBe("<p>Again</p>");
    expect(loadCount).toBe(1);
  });

  it("returns a transform diagnostic when WASM loading fails", async () => {
    const transformService = new TransformService(async () => {
      throw new Error("WASM artifact is missing");
    });

    const response = await transformService.transform("# Title");

    expect(response.html).toBe("");
    expect(response.diagnostics).toEqual([
      {
        message: "WASM artifact is missing",
        severity: "error",
        source: "transform",
      },
    ]);
  });
});
