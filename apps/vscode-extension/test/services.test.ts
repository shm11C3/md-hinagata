import { describe, expect, it } from "vitest";

import type { DiagnosticMessage } from "../src/services/diagnosticsService.js";
import { DiagnosticsService } from "../src/services/diagnosticsService.js";
import { WorkspaceTrustService } from "../src/services/workspaceTrustService.js";

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
});
