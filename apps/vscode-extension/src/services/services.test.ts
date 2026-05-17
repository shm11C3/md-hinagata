import { describe, expect, it } from "vitest";

import type { DiagnosticMessage } from "./diagnosticsService.js";
import { DiagnosticsService } from "./diagnosticsService.js";
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
