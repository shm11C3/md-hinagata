import { describe, expect, it } from "vitest";

import { DocumentStateService } from "./documentStateService.js";
import { ThemeFileRefreshService } from "./themeFileRefreshService.js";
import type { ThemeFileReference } from "./themeResolver.js";

describe("ThemeFileRefreshService", () => {
  it("refreshes the active document when a current theme file is saved", () => {
    const documentStateService = createDocumentStateWithThemeFiles([
      {
        kind: "manifest",
        label: "theme.json",
        path: "/themes/basic/theme.json",
      },
      {
        kind: "stylesheet",
        label: "styles.css",
        path: "/themes/basic/styles.css",
      },
      {
        kind: "template",
        label: "h1.hbs",
        path: "/themes/basic/templates/h1.hbs",
        templateKey: "h1",
      },
    ]);
    let refreshCount = 0;
    const refreshService = new ThemeFileRefreshService(
      documentStateService,
      () => {
        refreshCount += 1;
      },
    );

    expect(
      refreshService.refreshIfCurrentThemeFile({
        uri: { fsPath: "/themes/basic/theme.json" },
      }),
    ).toBe(true);
    expect(
      refreshService.refreshIfCurrentThemeFile({
        uri: { fsPath: "/themes/basic/styles.css" },
      }),
    ).toBe(true);
    expect(
      refreshService.refreshIfCurrentThemeFile({
        uri: { fsPath: "/themes/basic/templates/h1.hbs" },
      }),
    ).toBe(true);

    expect(refreshCount).toBe(3);
  });

  it("does not refresh when an unused theme file is saved", () => {
    const documentStateService = createDocumentStateWithThemeFiles([
      {
        kind: "stylesheet",
        label: "styles.css",
        path: "/themes/basic/styles.css",
      },
    ]);
    let refreshCount = 0;
    const refreshService = new ThemeFileRefreshService(
      documentStateService,
      () => {
        refreshCount += 1;
      },
    );

    expect(
      refreshService.refreshIfCurrentThemeFile({
        uri: { fsPath: "/themes/unused/styles.css" },
      }),
    ).toBe(false);

    expect(refreshCount).toBe(0);
  });

  it("does not refresh when there is no active Markdown document", () => {
    const documentStateService = new DocumentStateService();
    let refreshCount = 0;
    const refreshService = new ThemeFileRefreshService(
      documentStateService,
      () => {
        refreshCount += 1;
      },
    );

    expect(
      refreshService.refreshIfCurrentThemeFile({
        uri: { fsPath: "/themes/basic/styles.css" },
      }),
    ).toBe(false);

    expect(refreshCount).toBe(0);
  });
});

function createDocumentStateWithThemeFiles(
  themeFiles: readonly ThemeFileReference[],
): DocumentStateService {
  const documentStateService = new DocumentStateService();
  documentStateService.setActiveDocument({
    languageId: "markdown",
    markdown: "# Title",
    uri: "file:///article.md",
  });
  documentStateService.applyTransformResult(
    {
      css: ".basic {}",
      diagnostics: [],
      html: "<h1>Title</h1>",
      resolvedThemeId: "basic",
    },
    {
      themeFiles,
    },
  );
  return documentStateService;
}
