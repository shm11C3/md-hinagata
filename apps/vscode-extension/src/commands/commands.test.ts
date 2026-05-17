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
  canSelectTheme: (themeId: string, options: { isWorkspaceTrusted: boolean }) =>
    options.isWorkspaceTrusted || themeId === "default",
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
    documentStateService.setGeneratedHtml("<h1>Hello</h1>");

    await copyGeneratedHtml(
      {
        writeText: (value) => {
          writes.push(value);
        },
      },
      documentStateService,
    );

    expect(writes).toEqual(["<h1>Hello</h1>"]);
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

  it("updates the selected theme when a theme id is provided", () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);

    expect(
      selectTheme(
        documentStateService,
        workspaceTrustService,
        themeResolver,
        " basic ",
      ),
    ).toBe("basic");
    expect(documentStateService.getCurrentTheme()).toBe("basic");
  });

  it("keeps the current theme when command input is missing", () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => true);

    expect(
      selectTheme(
        documentStateService,
        workspaceTrustService,
        themeResolver,
        undefined,
      ),
    ).toBe("default");
  });

  it("keeps workspace theme changes disabled in untrusted workspaces", () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => false);

    expect(
      selectTheme(
        documentStateService,
        workspaceTrustService,
        themeResolver,
        "workspace-theme",
      ),
    ).toBe("default");
    expect(documentStateService.getCurrentTheme()).toBe("default");
  });

  it("allows the bundled default theme in untrusted workspaces", () => {
    const documentStateService = new DocumentStateService();
    const workspaceTrustService = new WorkspaceTrustService(() => false);
    documentStateService.setCurrentTheme("workspace-theme");

    expect(
      selectTheme(
        documentStateService,
        workspaceTrustService,
        themeResolver,
        " default ",
      ),
    ).toBe("default");
  });
});
