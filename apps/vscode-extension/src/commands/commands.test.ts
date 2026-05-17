import { describe, expect, it } from "vitest";
import { DocumentStateService } from "../services/documentStateService.js";
import { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import {
  getActiveMarkdownDocument,
  MARKDOWN_REQUIRED_MESSAGE,
} from "./activeMarkdownDocument.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import { openPreview } from "./openPreviewCommand.js";
import { openThemeFile } from "./openThemeFileCommand.js";
import { selectTheme } from "./selectThemeCommand.js";

const themeResolver = {
  canSelectTheme: (themeId: string) => themeId.length > 0,
  listSelectableThemes: async () => [
    {
      id: "default",
      source: "bundled" as const,
    },
    {
      id: "basic",
      source: "workspace" as const,
    },
  ],
};

describe("extension commands", () => {
  it("defines stable command ids", () => {
    expect(COMMAND_IDS).toEqual({
      copyGeneratedHtml: "md-hinagata.copyGeneratedHtml",
      openThemeFile: "md-hinagata.openThemeFile",
      openPreview: "md-hinagata.openPreview",
      selectTheme: "md-hinagata.selectTheme",
    });
  });

  it("opens the preview panel", async () => {
    let openCount = 0;

    await openPreview({
      show: () => {
        openCount += 1;
      },
    });

    expect(openCount).toBe(1);
  });

  it("returns the active Markdown document", () => {
    const messages: string[] = [];
    const document = {
      getText: () => "# Title",
      languageId: "markdown",
      uri: {
        toString: () => "file:///article.md",
      },
    };

    expect(
      getActiveMarkdownDocument({
        activeTextEditor: { document },
        showInformationMessage: (message) => messages.push(message),
      }),
    ).toBe(document);
    expect(messages).toEqual([]);
  });

  it("shows a clear message when no Markdown document is active", () => {
    const messages: string[] = [];

    expect(
      getActiveMarkdownDocument({
        activeTextEditor: {
          document: {
            getText: () => "plain text",
            languageId: "plaintext",
            uri: {
              toString: () => "file:///notes.txt",
            },
          },
        },
        showInformationMessage: (message) => messages.push(message),
      }),
    ).toBeUndefined();
    expect(messages).toEqual([MARKDOWN_REQUIRED_MESSAGE]);
  });

  it("copies the latest generated html", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Hello",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "<h1>Hello</h1>",
      resolvedThemeId: "default",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () => documentStateService.getState(),
      }),
    ).resolves.toBe(true);

    expect(writes).toEqual(["<h1>Hello</h1>"]);
    expect(messages).toEqual(["info:Generated HTML copied."]);
  });

  it("refreshes stale generated html before copying", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Hello",
      uri: "file:///article.md",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () =>
          documentStateService.applyTransformResult({
            diagnostics: [],
            html: "<h1>Hello</h1>",
            resolvedThemeId: "default",
          }),
      }),
    ).resolves.toBe(true);

    expect(writes).toEqual(["<h1>Hello</h1>"]);
    expect(messages).toEqual(["info:Generated HTML copied."]);
  });

  it("shows a clear copy error when clipboard writing fails", async () => {
    const documentStateService = new DocumentStateService();
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Hello",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "<h1>Hello</h1>",
      resolvedThemeId: "default",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: () => {
            throw new Error("Clipboard unavailable.");
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () => documentStateService.getState(),
      }),
    ).resolves.toBe(false);

    expect(messages).toEqual([
      "error:Failed to copy generated HTML: Clipboard unavailable.",
    ]);
  });

  it("does not copy generated html when no markdown document state is active", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () => documentStateService.getState(),
      }),
    ).resolves.toBe(false);

    expect(writes).toEqual([]);
    expect(messages).toEqual([
      "error:Open a Markdown file before copying generated HTML.",
    ]);
  });

  it("copies a valid empty html fragment after refresh", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "",
      uri: "file:///article.md",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () =>
          documentStateService.applyTransformResult({
            diagnostics: [],
            html: "",
            resolvedThemeId: "default",
          }),
      }),
    ).resolves.toBe(true);

    expect(writes).toEqual([""]);
    expect(messages).toEqual(["info:Generated HTML copied."]);
  });

  it("does not copy when refresh cannot provide active document state", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Hello",
      uri: "file:///article.md",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () => documentStateService.setInactive(),
      }),
    ).resolves.toBe(false);

    expect(writes).toEqual([]);
    expect(messages).toEqual([
      "error:Generated HTML is not available for the current document.",
    ]);
  });

  it("uses the latest generated html from refreshed document state", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Before",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "<h1>Before</h1>",
      resolvedThemeId: "default",
    });
    documentStateService.updateMarkdown("file:///article.md", "# After");

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () =>
          documentStateService.applyTransformResult({
            diagnostics: [],
            html: "<h1>After</h1>",
            resolvedThemeId: "default",
          }),
      }),
    ).resolves.toBe(true);

    expect(writes).toEqual(["<h1>After</h1>"]);
    expect(messages).toEqual(["info:Generated HTML copied."]);
  });

  it("preserves generated html when state is current", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    let refreshCount = 0;
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Current",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: "<h1>Current</h1>",
      resolvedThemeId: "default",
    });

    await expect(
      copyGeneratedHtml({
        clipboard: {
          writeText: (value) => {
            writes.push(value);
          },
        },
        documentStateService,
        notifier: createMessageRecorder(messages),
        refreshActiveDocument: async () => {
          refreshCount += 1;
          return documentStateService.getState();
        },
      }),
    ).resolves.toBe(true);

    expect(refreshCount).toBe(0);
    expect(writes).toEqual(["<h1>Current</h1>"]);
  });

  it("opens only files from the current resolved theme", async () => {
    const documentStateService = new DocumentStateService();
    const openedPaths: string[] = [];

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult(
      {
        diagnostics: [],
        html: "<h1>Title</h1>",
        resolvedThemeId: "basic",
      },
      {
        themeFiles: [
          {
            kind: "manifest",
            label: "theme.json",
            path: "/theme/basic/theme.json",
          },
        ],
      },
    );

    await expect(
      openThemeFile(
        documentStateService,
        {
          open: (filePath) => {
            openedPaths.push(filePath);
          },
        },
        "/theme/basic/theme.json",
      ),
    ).resolves.toBe(true);
    await expect(
      openThemeFile(
        documentStateService,
        {
          open: (filePath) => {
            openedPaths.push(filePath);
          },
        },
        "/theme/other/theme.json",
      ),
    ).resolves.toBe(false);

    expect(openedPaths).toEqual(["/theme/basic/theme.json"]);
  });

  it("returns false when opening a current theme file fails", async () => {
    const documentStateService = new DocumentStateService();

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult(
      {
        diagnostics: [],
        html: "<h1>Title</h1>",
        resolvedThemeId: "basic",
      },
      {
        themeFiles: [
          {
            kind: "manifest",
            label: "theme.json",
            path: "/theme/basic/theme.json",
          },
        ],
      },
    );

    await expect(
      openThemeFile(
        documentStateService,
        {
          open: () => {
            throw new Error("Failed to open file.");
          },
        },
        "/theme/basic/theme.json",
      ),
    ).resolves.toBe(false);
  });

  it("updates frontmatter when a theme id is provided", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument("# Title\n");
    const messages: string[] = [];
    let refreshCount = 0;

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder(messages),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {
          refreshCount += 1;
        },
        themeId: " basic ",
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("basic");

    expect(documentStateService.getCurrentTheme()).toBe("basic");
    expect(editableDocument.getText()).toBe(
      "---\nhinagata:\n  theme: basic\n---\n\n# Title\n",
    );
    expect(refreshCount).toBe(1);
    expect(messages).toEqual(["info:Selected md-hinagata theme 'basic'."]);
  });

  it("uses Quick Pick when command input is missing", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument(
      "---\ntitle: Article\n---\n# Title\n",
    );
    const messages: string[] = [];
    const pickerLabels: string[] = [];

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder(messages),
        picker: {
          showQuickPick: async (items) => {
            pickerLabels.push(...items.map((item) => item.label));
            return items.find((item) => item.themeId === "basic");
          },
        },
        refreshActiveDocument: async () => {},
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("basic");

    expect(pickerLabels).toEqual(["default", "basic"]);
    expect(editableDocument.getText()).toBe(
      "---\ntitle: Article\n\nhinagata:\n  theme: basic\n---\n# Title\n",
    );
  });

  it("keeps the current theme when Quick Pick is cancelled", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument("# Title\n");

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder([]),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {
          throw new Error("refresh should not run");
        },
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("default");
    expect(editableDocument.getText()).toBe("# Title\n");
  });

  it("notifies when no themes are available for Quick Pick", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument("# Title\n");
    const messages: string[] = [];

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder(messages),
        picker: {
          showQuickPick: async () => {
            throw new Error("picker should not open");
          },
        },
        refreshActiveDocument: async () => {
          throw new Error("refresh should not run");
        },
        themeResolver: {
          canSelectTheme: themeResolver.canSelectTheme,
          listSelectableThemes: async () => [],
        },
        workspaceTrustService,
      }),
    ).resolves.toBe("default");

    expect(editableDocument.getText()).toBe("# Title\n");
    expect(messages).toEqual(["info:No md-hinagata themes are available."]);
  });

  it("keeps workspace theme changes disabled in untrusted workspaces", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => false);
    const editableDocument = createEditableDocument("# Title\n");
    const messages: string[] = [];

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder(messages),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {},
        themeId: "workspace-theme",
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("default");

    expect(documentStateService.getCurrentTheme()).toBe("default");
    expect(editableDocument.getText()).toBe("# Title\n");
    expect(messages).toEqual([
      "warning:Theme 'workspace-theme' is not available.",
    ]);
  });

  it("allows the bundled default theme in untrusted workspaces", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => false);
    const editableDocument = createEditableDocument("# Title\n");
    documentStateService.setCurrentTheme("workspace-theme");

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder([]),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {},
        themeId: " default ",
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("default");

    expect(editableDocument.getText()).toContain("theme: default");
  });

  it("allows bundled non-default themes in untrusted workspaces", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => false);
    const editableDocument = createEditableDocument("# Title\n");

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder([]),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {},
        themeId: " basic ",
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("basic");

    expect(editableDocument.getText()).toContain("theme: basic");
  });

  it("warns when frontmatter cannot be updated safely", async () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument(
      "---\nhinagata: [\n---\n# Title\n",
    );
    const messages: string[] = [];

    await expect(
      selectTheme({
        document: editableDocument.document,
        documentStateService,
        notifier: createMessageRecorder(messages),
        picker: {
          showQuickPick: async () => undefined,
        },
        refreshActiveDocument: async () => {},
        themeId: "basic",
        themeResolver,
        workspaceTrustService,
      }),
    ).resolves.toBe("default");

    expect(editableDocument.getText()).toBe("---\nhinagata: [\n---\n# Title\n");
    expect(messages).toEqual([
      "warning:Could not update frontmatter: Frontmatter could not be parsed safely.",
    ]);
  });
});

function createMessageRecorder(messages: string[]) {
  return {
    showErrorMessage: (message: string) => {
      messages.push(`error:${message}`);
    },
    showInformationMessage: (message: string) => {
      messages.push(`info:${message}`);
    },
    showWarningMessage: (message: string) => {
      messages.push(`warning:${message}`);
    },
  };
}

function createEditableDocument(source: string) {
  let text = source;
  return {
    document: {
      getText: () => text,
      replaceText: async (nextText: string) => {
        text = nextText;
        return true;
      },
    },
    getText: () => text,
  };
}
