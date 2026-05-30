import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DocumentStateService } from "../services/documentStateService.js";
import { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import {
  getActiveMarkdownDocument,
  getVisibleMarkdownDocument,
  hasCurrentMarkdownDocument,
  MARKDOWN_REQUIRED_MESSAGE,
  openCurrentMarkdownDocument,
  prepareCurrentMarkdownDocument,
} from "./activeMarkdownDocument.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import {
  createThemeDisplayName,
  createThemeFromDefault,
  validateCreatableThemeId,
} from "./createThemeFromDefaultCommand.js";
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
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), "md-hinagata-command-"));
  });

  afterEach(async () => {
    await rm(testRoot, { force: true, recursive: true });
  });

  it("defines stable command ids", () => {
    expect(COMMAND_IDS).toEqual({
      copyGeneratedHtml: "md-hinagata.copyGeneratedHtml",
      createThemeFromDefault: "md-hinagata.createThemeFromDefault",
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

  it("recognizes stored Markdown state when editor focus moves away", () => {
    const documentStateService = new DocumentStateService();

    expect(
      hasCurrentMarkdownDocument(
        { activeTextEditor: undefined },
        documentStateService,
      ),
    ).toBe(false);

    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });

    expect(
      hasCurrentMarkdownDocument(
        { activeTextEditor: undefined },
        documentStateService,
      ),
    ).toBe(true);
  });

  it("uses a single visible Markdown document when focus is on another editor", () => {
    const markdownDocument = {
      getText: () => "# Title",
      languageId: "markdown",
      uri: {
        toString: () => "file:///article.md",
      },
    };

    expect(
      getVisibleMarkdownDocument({
        visibleTextEditors: [
          {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          { document: markdownDocument },
        ],
      }),
    ).toBe(markdownDocument);
  });

  it("does not guess when multiple Markdown documents are visible", () => {
    expect(
      getVisibleMarkdownDocument({
        visibleTextEditors: [
          {
            document: {
              getText: () => "# One",
              languageId: "markdown",
              uri: {
                toString: () => "file:///one.md",
              },
            },
          },
          {
            document: {
              getText: () => "# Two",
              languageId: "markdown",
              uri: {
                toString: () => "file:///two.md",
              },
            },
          },
        ],
      }),
    ).toBeUndefined();
  });

  it("opens the stored Markdown document when no Markdown editor is active", async () => {
    const documentStateService = new DocumentStateService();
    const document = {
      getText: () => "# Title",
      languageId: "markdown",
      uri: {
        toString: () => "file:///article.md",
      },
    };
    const openedUris: string[] = [];
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });

    await expect(
      openCurrentMarkdownDocument(
        { activeTextEditor: undefined },
        documentStateService,
        {
          openTextDocument: async (uri) => {
            openedUris.push(uri);
            return document;
          },
        },
      ),
    ).resolves.toBe(document);
    expect(openedUris).toEqual(["file:///article.md"]);
  });

  it("does not reuse stored state when the reopened document is not Markdown", async () => {
    const documentStateService = new DocumentStateService();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///article.md",
    });

    await expect(
      openCurrentMarkdownDocument(
        { activeTextEditor: undefined },
        documentStateService,
        {
          openTextDocument: async () => ({
            getText: () => "plain text",
            languageId: "plaintext",
            uri: {
              toString: () => "file:///article.md",
            },
          }),
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("does not throw when the stored Markdown document cannot be reopened", async () => {
    const documentStateService = new DocumentStateService();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Title",
      uri: "file:///missing.md",
    });

    await expect(
      openCurrentMarkdownDocument(
        { activeTextEditor: undefined },
        documentStateService,
        {
          openTextDocument: async () => {
            throw new Error("missing document");
          },
        },
      ),
    ).resolves.toBeUndefined();
  });

  it("opens the visible Markdown document when stored state is unavailable", async () => {
    const documentStateService = new DocumentStateService();
    const visibleDocument = {
      getText: () => "# Visible",
      languageId: "markdown",
      uri: {
        toString: () => "file:///visible.md",
      },
    };

    await expect(
      openCurrentMarkdownDocument(
        {
          activeTextEditor: {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          visibleTextEditors: [{ document: visibleDocument }],
        },
        documentStateService,
        {
          openTextDocument: async () => {
            throw new Error("should not reopen without stored state");
          },
        },
      ),
    ).resolves.toBe(visibleDocument);
  });

  it("uses the single visible Markdown document before stored state", async () => {
    const documentStateService = new DocumentStateService();
    const storedDocument = {
      getText: () => "# Stored",
      languageId: "markdown",
      uri: {
        toString: () => "file:///stored.md",
      },
    };
    const visibleDocument = {
      getText: () => "# Visible",
      languageId: "markdown",
      uri: {
        toString: () => "file:///visible.md",
      },
    };
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Stored",
      uri: "file:///stored.md",
    });

    await expect(
      openCurrentMarkdownDocument(
        {
          activeTextEditor: {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          visibleTextEditors: [{ document: visibleDocument }],
        },
        documentStateService,
        {
          openTextDocument: async () => storedDocument,
        },
      ),
    ).resolves.toBe(visibleDocument);
  });

  it("uses stored Markdown state when visible Markdown documents are ambiguous", async () => {
    const documentStateService = new DocumentStateService();
    const storedDocument = {
      getText: () => "# Stored",
      languageId: "markdown",
      uri: {
        toString: () => "file:///stored.md",
      },
    };
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Stored",
      uri: "file:///stored.md",
    });

    await expect(
      openCurrentMarkdownDocument(
        {
          activeTextEditor: {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          visibleTextEditors: [
            {
              document: {
                getText: () => "# Visible 1",
                languageId: "markdown",
                uri: {
                  toString: () => "file:///visible-1.md",
                },
              },
            },
            {
              document: {
                getText: () => "# Visible 2",
                languageId: "markdown",
                uri: {
                  toString: () => "file:///visible-2.md",
                },
              },
            },
          ],
        },
        documentStateService,
        {
          openTextDocument: async () => storedDocument,
        },
      ),
    ).resolves.toBe(storedDocument);
  });

  it("refreshes stored state from a single visible Markdown document", () => {
    const documentStateService = new DocumentStateService();
    const visibleDocument = {
      getText: () => "---\nhinagata:\n  theme: basic\n---\n# Visible",
      languageId: "markdown",
      uri: {
        toString: () => "file:///visible.md",
      },
    };
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "---\nhinagata:\n  theme: default\n---\n# Stored",
      uri: "file:///stored.md",
    });

    expect(
      prepareCurrentMarkdownDocument(
        {
          activeTextEditor: {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          visibleTextEditors: [{ document: visibleDocument }],
        },
        documentStateService,
      ),
    ).toBe(true);

    expect(documentStateService.getState()).toMatchObject({
      markdown: visibleDocument.getText(),
      status: "active",
      uri: "file:///visible.md",
    });
  });

  it("keeps stored state as a fallback when no Markdown editor is visible", () => {
    const documentStateService = new DocumentStateService();
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "---\nhinagata:\n  theme: default\n---\n# Stored",
      uri: "file:///stored.md",
    });

    expect(
      prepareCurrentMarkdownDocument(
        {
          activeTextEditor: {
            document: {
              getText: () => "plain text",
              languageId: "plaintext",
              uri: {
                toString: () => "file:///notes.txt",
              },
            },
          },
          visibleTextEditors: [],
        },
        documentStateService,
      ),
    ).toBe(true);

    expect(documentStateService.getState()).toMatchObject({
      markdown: "---\nhinagata:\n  theme: default\n---\n# Stored",
      status: "active",
      uri: "file:///stored.md",
    });
  });

  it("copies the latest generated html including theme css", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    const generatedHtml = [
      "<style>",
      ".article { color: red; }",
      "</style>",
      '<main class="mh-document">',
      "<h1>Hello</h1>",
      "</main>",
    ].join("\n");
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "# Hello",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      css: ".article { color: red; }",
      diagnostics: [],
      html: generatedHtml,
      resolvedCssMode: "style-tag",
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

    expect(writes).toEqual([generatedHtml]);
    expect(writes[0]).toContain("<style>");
    expect(writes[0]).toContain(".article { color: red; }");
    expect(messages).toEqual(["info:Generated HTML copied."]);
  });

  it("copies inline generated html without css-specific post-processing", async () => {
    const documentStateService = new DocumentStateService();
    const writes: string[] = [];
    const messages: string[] = [];
    const generatedHtml = [
      '<main class="mh-document">',
      '<p style="color: red;">Hello</p>',
      "</main>",
    ].join("\n");
    documentStateService.setActiveDocument({
      languageId: "markdown",
      markdown: "---\nhinagata:\n  cssMode: inline\n---\nHello",
      uri: "file:///article.md",
    });
    documentStateService.applyTransformResult({
      diagnostics: [],
      html: generatedHtml,
      resolvedCssMode: "inline",
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

    expect(writes).toEqual([generatedHtml]);
    expect(writes[0]).not.toContain("<style>");
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
            resolvedCssMode: "style-tag",
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
      resolvedCssMode: "style-tag",
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
            resolvedCssMode: "style-tag",
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
      resolvedCssMode: "style-tag",
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
            resolvedCssMode: "style-tag",
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
      resolvedCssMode: "style-tag",
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
        resolvedCssMode: "style-tag",
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
        resolvedCssMode: "style-tag",
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

  it("validates creatable theme ids without loosening resolver rules", () => {
    expect(validateCreatableThemeId("company-blog")).toBeUndefined();
    expect(validateCreatableThemeId("internal_wiki")).toBeUndefined();
    expect(createThemeDisplayName("company-blog")).toBe("Company Blog");
    expect(createThemeDisplayName("internal_wiki")).toBe("Internal Wiki");
    expect(validateCreatableThemeId("brand theme")).toBe(
      "Theme ID must not contain whitespace.",
    );
    expect(validateCreatableThemeId(" default")).toBe(
      "Theme ID must not contain whitespace.",
    );

    for (const invalidPathLikeThemeId of [
      "",
      ".",
      "..",
      "/",
      "\\",
      "../theme",
      "/etc/passwd",
      "C:\\Windows",
    ]) {
      expect(validateCreatableThemeId(invalidPathLikeThemeId)).toBe(
        "Theme ID must be a non-empty name, not a path.",
      );
    }

    expect(validateCreatableThemeId("default")).toBe(
      "Theme ID 'default' is reserved.",
    );
    expect(validateCreatableThemeId("--")).toBe(
      "Theme ID must contain a name.",
    );
  });

  it("creates a workspace theme from the bundled default theme and updates active Markdown", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    await mkdir(workspaceRoot, { recursive: true });
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);
    const editableDocument = createEditableDocument("# Title\n");
    const messages: string[] = [];
    const openedFiles: string[] = [];
    let refreshCount = 0;

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "company-blog",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        document: editableDocument.document,
        documentStateService,
        fileOpener: {
          open: (filePath) => {
            openedFiles.push(filePath);
          },
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          refreshCount += 1;
        },
        workspaceFolders: [
          {
            name: "workspace",
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService,
      }),
    ).resolves.toBe("company-blog");

    const themeRoot = path.join(
      workspaceRoot,
      ".md-hinagata",
      "themes",
      "company-blog",
    );
    const manifest = JSON.parse(
      await readFile(path.join(themeRoot, "theme.json"), "utf8"),
    ) as {
      entryCss: string;
      id: string;
      name: string;
      schemaVersion: string;
      templates: Record<string, string>;
      version: string;
    };

    expect(manifest).toMatchObject({
      entryCss: "styles.css",
      id: "company-blog",
      name: "Company Blog",
      schemaVersion: "0.1",
      templates: {
        h1: "templates/h1.hbs",
        codeblock: "templates/codeblock.hbs",
      },
      version: "0.1.0",
    });
    await expect(
      readFile(path.join(themeRoot, "templates", "h1.hbs"), "utf8"),
    ).resolves.toContain("mh-heading--h1");
    expect(editableDocument.getText()).toBe(
      "---\nhinagata:\n  theme: company-blog\n---\n\n# Title\n",
    );
    expect(documentStateService.getCurrentTheme()).toBe("company-blog");
    expect(openedFiles).toEqual([path.join(themeRoot, "theme.json")]);
    expect(refreshCount).toBe(1);
    expect(messages).toEqual([
      "info:Created md-hinagata theme 'company-blog'.",
    ]);
  });

  it("creates a workspace theme without an active Markdown document", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const documentStateService = new DocumentStateService();
    const messages: string[] = [];
    let refreshCount = 0;

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "docs",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        documentStateService,
        fileOpener: {
          open: () => {},
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          refreshCount += 1;
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBe("docs");

    await expect(
      readFile(
        path.join(
          workspaceRoot,
          ".md-hinagata",
          "themes",
          "docs",
          "theme.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"id": "docs"');
    expect(documentStateService.getCurrentTheme()).toBe("default");
    expect(refreshCount).toBe(0);
    expect(messages).toEqual(["info:Created md-hinagata theme 'docs'."]);
  });

  it("keeps the created theme when active Markdown frontmatter cannot be updated", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const editableDocument = createEditableDocument(
      "---\nhinagata: [\n---\n# Title\n",
    );
    const messages: string[] = [];
    let refreshCount = 0;

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "kept-theme",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        document: editableDocument.document,
        documentStateService: new DocumentStateService(),
        fileOpener: {
          open: () => {},
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          refreshCount += 1;
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBe("kept-theme");

    await expect(
      readFile(
        path.join(
          workspaceRoot,
          ".md-hinagata",
          "themes",
          "kept-theme",
          "theme.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"id": "kept-theme"');
    expect(editableDocument.getText()).toBe("---\nhinagata: [\n---\n# Title\n");
    expect(refreshCount).toBe(0);
    expect(messages).toEqual([
      "warning:Theme was created, but the active document could not be updated: Frontmatter could not be parsed safely.",
      "info:Created md-hinagata theme 'kept-theme'.",
    ]);
  });

  it("keeps the created theme when active Markdown replacement fails", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const documentStateService = new DocumentStateService();
    const messages: string[] = [];
    let refreshCount = 0;

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "replace-error",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        document: {
          getText: () => "# Title\n",
          replaceText: async () => {
            throw new Error("Editor rejected the change.");
          },
        },
        documentStateService,
        fileOpener: {
          open: () => {},
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          refreshCount += 1;
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBe("replace-error");

    await expect(
      readFile(
        path.join(
          workspaceRoot,
          ".md-hinagata",
          "themes",
          "replace-error",
          "theme.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"id": "replace-error"');
    expect(documentStateService.getCurrentTheme()).toBe("default");
    expect(refreshCount).toBe(0);
    expect(messages).toEqual([
      "warning:Theme was created, but the active document could not be updated: Editor rejected the change.",
      "info:Created md-hinagata theme 'replace-error'.",
    ]);
  });

  it("warns when preview refresh fails after updating active Markdown", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const documentStateService = new DocumentStateService();
    const editableDocument = createEditableDocument("# Title\n");
    const messages: string[] = [];

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "refresh-warning",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        document: editableDocument.document,
        documentStateService,
        fileOpener: {
          open: () => {},
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          throw new Error("Preview unavailable.");
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBe("refresh-warning");

    expect(editableDocument.getText()).toBe(
      "---\nhinagata:\n  theme: refresh-warning\n---\n\n# Title\n",
    );
    expect(documentStateService.getCurrentTheme()).toBe("refresh-warning");
    expect(messages).toEqual([
      "warning:Theme was created, but the preview could not be refreshed: Preview unavailable.",
      "info:Created md-hinagata theme 'refresh-warning'.",
    ]);
  });

  it("does not create themes in untrusted workspaces", async () => {
    const workspaceRoot = path.join(testRoot, "workspace");
    const messages: string[] = [];

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "blocked",
        },
        defaultThemeRoots: [path.join(testRoot, "bundled")],
        documentStateService: new DocumentStateService(),
        fileOpener: {
          open: () => {
            throw new Error("open should not run");
          },
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          throw new Error("refresh should not run");
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => false),
      }),
    ).resolves.toBeUndefined();

    expect(messages).toEqual([
      "warning:Workspace themes are disabled in untrusted workspaces. Trust this workspace to create a theme.",
    ]);
  });

  it("does not overwrite an existing workspace theme", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const existingThemeRoot = path.join(
      workspaceRoot,
      ".md-hinagata",
      "themes",
      "company-blog",
    );
    await mkdir(existingThemeRoot, { recursive: true });
    await writeFile(
      path.join(existingThemeRoot, "theme.json"),
      "existing",
      "utf8",
    );
    const messages: string[] = [];

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "company-blog",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        documentStateService: new DocumentStateService(),
        fileOpener: {
          open: () => {
            throw new Error("open should not run");
          },
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          throw new Error("refresh should not run");
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBeUndefined();

    await expect(
      readFile(path.join(existingThemeRoot, "theme.json"), "utf8"),
    ).resolves.toBe("existing");
    expect(messages).toEqual([
      "error:Failed to create theme 'company-blog': Theme 'company-blog' already exists.",
    ]);
  });

  it("cleans up the temporary theme directory when creation fails", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
      {
        manifest: "{",
      },
    );
    const workspaceRoot = path.join(testRoot, "workspace");
    const messages: string[] = [];

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "broken-theme",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        documentStateService: new DocumentStateService(),
        fileOpener: {
          open: () => {
            throw new Error("open should not run");
          },
        },
        notifier: createMessageRecorder(messages),
        picker: createFailingCreateThemePicker(),
        refreshActiveDocument: async () => {
          throw new Error("refresh should not run");
        },
        workspaceFolders: [
          {
            uri: createUri(workspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBeUndefined();

    const themeParentEntries = await readdir(
      path.join(workspaceRoot, ".md-hinagata", "themes"),
    );
    expect(themeParentEntries).toEqual([]);
    expect(messages[0]).toMatch(
      /^error:Failed to create theme 'broken-theme': /,
    );
  });

  it("uses Quick Pick for multi-root target workspace selection", async () => {
    const defaultThemeRoot = await writeDefaultThemeFixture(
      path.join(testRoot, "bundled", "default"),
    );
    const firstWorkspaceRoot = path.join(testRoot, "first");
    const secondWorkspaceRoot = path.join(testRoot, "second");
    const pickerLabels: string[] = [];

    await expect(
      createThemeFromDefault({
        args: {
          themeId: "picked-theme",
        },
        defaultThemeRoots: [path.dirname(defaultThemeRoot)],
        documentStateService: new DocumentStateService(),
        fileOpener: {
          open: () => {},
        },
        notifier: createMessageRecorder([]),
        picker: {
          showInputBox: async () => {
            throw new Error("input box should not open");
          },
          showQuickPick: async (items) => {
            pickerLabels.push(...items.map((item) => item.label));
            return items.find((item) => item.label === "second");
          },
        },
        refreshActiveDocument: async () => {},
        workspaceFolders: [
          {
            name: "first",
            uri: createUri(firstWorkspaceRoot),
          },
          {
            name: "second",
            uri: createUri(secondWorkspaceRoot),
          },
        ],
        workspaceTrustService: new WorkspaceTrustService(() => true),
      }),
    ).resolves.toBe("picked-theme");

    expect(pickerLabels).toEqual(["first", "second"]);
    await expect(
      readFile(
        path.join(
          secondWorkspaceRoot,
          ".md-hinagata",
          "themes",
          "picked-theme",
          "theme.json",
        ),
        "utf8",
      ),
    ).resolves.toContain('"id": "picked-theme"');
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

function createFailingCreateThemePicker() {
  return {
    showInputBox: async () => {
      throw new Error("input box should not open");
    },
    showQuickPick: async () => {
      throw new Error("quick pick should not open");
    },
  };
}

function createUri(filePath: string) {
  const fileUri = pathToFileURL(filePath);
  return {
    fsPath: filePath,
    toString: () => fileUri.toString(),
  };
}

async function writeDefaultThemeFixture(
  themeRoot: string,
  options: {
    manifest?: string;
  } = {},
): Promise<string> {
  await mkdir(path.join(themeRoot, "templates"), { recursive: true });
  await writeFile(
    path.join(themeRoot, "styles.css"),
    ".mh-document {}",
    "utf8",
  );
  await writeFile(
    path.join(themeRoot, "templates", "h1.hbs"),
    '<h1 class="mh-heading mh-heading--h1">{{{inner_html}}}</h1>',
    "utf8",
  );
  await writeFile(
    path.join(themeRoot, "templates", "codeblock.hbs"),
    '<pre class="mh-codeblock"><code>{{code}}</code></pre>',
    "utf8",
  );
  await writeFile(
    path.join(themeRoot, "theme.json"),
    options.manifest ??
      `${JSON.stringify(
        {
          $schema: "https://example.test/theme.schema.json",
          entryCss: "styles.css",
          id: "default",
          name: "Default",
          schemaVersion: "0.1",
          templates: {
            codeblock: "templates/codeblock.hbs",
            h1: "templates/h1.hbs",
          },
          version: "0.1.0",
        },
        null,
        2,
      )}\n`,
    "utf8",
  );

  return themeRoot;
}
