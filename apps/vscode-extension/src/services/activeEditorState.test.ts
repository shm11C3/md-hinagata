import { describe, expect, it } from "vitest";

import { updateActiveEditorState } from "./activeEditorState.js";
import { DocumentStateService } from "./documentStateService.js";

describe("active editor state", () => {
  it("keeps the current Markdown state when focus moves away from a text editor", () => {
    const documentStateService = new DocumentStateService();
    updateActiveEditorState(documentStateService, {
      document: {
        getText: () => "# Title",
        languageId: "markdown",
        uri: {
          toString: () => "file:///article.md",
        },
      },
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "<h1>Title</h1>",
      resolvedThemeId: "default",
    });

    updateActiveEditorState(documentStateService, undefined);

    expect(documentStateService.getState()).toMatchObject({
      generatedHtml: "<h1>Title</h1>",
      status: "active",
      uri: "file:///article.md",
    });
  });

  it("clears the current Markdown state when a non-Markdown editor is active", () => {
    const documentStateService = new DocumentStateService();
    updateActiveEditorState(documentStateService, {
      document: {
        getText: () => "# Title",
        languageId: "markdown",
        uri: {
          toString: () => "file:///article.md",
        },
      },
    });

    updateActiveEditorState(documentStateService, {
      document: {
        getText: () => "plain text",
        languageId: "plaintext",
        uri: {
          toString: () => "file:///notes.txt",
        },
      },
    });

    expect(documentStateService.getState()).toMatchObject({
      generatedHtml: "",
      status: "inactive",
    });
  });
});
