import { describe, expect, it } from "vitest";

import { COMMAND_IDS } from "../src/commands/commandIds.js";
import { copyGeneratedHtml } from "../src/commands/copyGeneratedHtmlCommand.js";
import { openPreview } from "../src/commands/openPreviewCommand.js";
import { selectTheme } from "../src/commands/selectThemeCommand.js";
import { DocumentStateService } from "../src/services/documentStateService.js";

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

    expect(selectTheme(documentStateService, " basic ")).toBe("basic");
    expect(documentStateService.getCurrentTheme()).toBe("basic");
  });

  it("keeps the current theme when command input is missing", () => {
    const documentStateService = new DocumentStateService();

    expect(selectTheme(documentStateService, undefined)).toBe("default");
  });
});
