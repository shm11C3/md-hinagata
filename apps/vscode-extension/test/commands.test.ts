import { describe, expect, it } from "vitest";

import { COMMAND_IDS } from "../src/commands/commandIds.js";
import { copyGeneratedHtml } from "../src/commands/copyGeneratedHtmlCommand.js";
import { openPreview } from "../src/commands/openPreviewCommand.js";
import { selectTheme } from "../src/commands/selectThemeCommand.js";
import { DocumentStateService } from "../src/services/documentStateService.js";
import { WorkspaceTrustService } from "../src/services/workspaceTrustService.js";

const themeResolver = {
  canSelectTheme: (themeId: string, options: { isWorkspaceTrusted: boolean }) =>
    options.isWorkspaceTrusted || themeId === "default",
};

describe("extension commands", () => {
  it("defines stable command ids", () => {
    expect(COMMAND_IDS).toEqual({
      copyGeneratedHtml: "md-hinagata.copyGeneratedHtml",
      openPreview: "md-hinagata.openPreview",
      selectTheme: "md-hinagata.selectTheme",
    });
  });

  it("opens the preview panel", async () => {
    let opened = false;

    await openPreview({
      show: () => {
        opened = true;
      },
    });

    expect(opened).toBe(true);
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
