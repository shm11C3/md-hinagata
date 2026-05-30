import { describe, expect, it } from "vitest";

import { DocumentStateService } from "./documentStateService.js";

describe("DocumentStateService.applyTransformResult fallbacks", () => {
  it("keeps the current theme and defaults options when they are omitted", () => {
    const service = new DocumentStateService();
    service.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///doc.md",
    });
    service.setCurrentTheme("basic");

    const state = service.applyTransformResult({
      diagnostics: [],
      html: "<h1>Title</h1>",
      resolvedCssMode: "style-tag",
      resolvedThemeId: undefined,
    } as never);

    expect(state.currentTheme).toBe("basic");
    expect(state.diagnostics).toEqual([]);
    expect(state.currentThemeFiles).toEqual([]);
    expect(state.generatedHtml).toContain("Title");
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
