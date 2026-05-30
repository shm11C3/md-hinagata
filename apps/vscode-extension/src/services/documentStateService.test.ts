import { describe, expect, it } from "vitest";

import { DocumentStateService } from "./documentStateService.js";

describe("DocumentStateService.applyTransformResult fallbacks", () => {
  it("keeps the current theme and defaults options when the result omits them", () => {
    const service = new DocumentStateService();
    service.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///doc.md",
    });
    service.setCurrentTheme("basic");

    const state = service.applyTransformResult({
      html: "<h1>Title</h1>",
      resolvedCssMode: "style-tag",
      resolvedThemeId: undefined,
    } as never);

    expect(state.currentTheme).toBe("basic");
    expect(state.diagnostics).toEqual([]);
    expect(state.themeFiles).toEqual([]);
    expect(state.isStale).toBe(false);
    expect(state.generatedHtml).toContain("Title");
  });

  it("ignores results for a document other than the expected one", () => {
    const service = new DocumentStateService();
    service.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///doc.md",
    });

    const unchanged = service.applyTransformResult(
      {
        diagnostics: [],
        html: "<h1>Other</h1>",
        resolvedCssMode: "style-tag",
        resolvedThemeId: "default",
      },
      { expectedUri: "file:///other.md" },
    );

    expect(unchanged.generatedHtml).toBe("");
    expect(unchanged.isStale).toBe(true);
  });

  it("ignores transform results when no document is active", () => {
    const service = new DocumentStateService();

    const state = service.applyTransformResult({
      diagnostics: [],
      html: "<h1>None</h1>",
      resolvedCssMode: "style-tag",
      resolvedThemeId: "default",
    });

    expect(state.status).not.toBe("active");
  });
});
