import { describe, expect, it } from "vitest";

import type { DiagnosticMessage } from "./diagnosticsService.js";
import { DiagnosticsService } from "./diagnosticsService.js";
import {
  createActiveDocumentSnapshot,
  DocumentStateService,
} from "./documentStateService.js";
import {
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

  it("passes transform requests to the loaded WASM module", async () => {
    let loadCount = 0;
    const loadModule: WasmTransformModuleLoader = async () => {
      loadCount += 1;
      return {
        transformMarkdownJson: (request) => ({
          diagnostics: [],
          html: `<p>${request.markdown}</p>`,
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
