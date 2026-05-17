import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { COMMAND_IDS } from "./src/commands/commandIds.js";
import { THEME_MANAGER_VIEW_ID } from "./src/views/themeEditorViewProvider.js";

interface ExtensionManifest {
  activationEvents?: string[];
  contributes: {
    commands: Array<{
      command: string;
    }>;
    views: Record<
      string,
      Array<{ icon: string; id: string; name: string; type: string }>
    >;
    viewsContainers: {
      activitybar: Array<{ icon: string; id: string; title: string }>;
    };
  };
  engines: {
    vscode: string;
  };
  main: string;
  scripts: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as ExtensionManifest;

describe("extension manifest", () => {
  it("targets the current VS Code API baseline", () => {
    expect(manifest.engines.vscode).toBe("^1.120.0");
  });

  it("points to the bundled extension entrypoint", () => {
    expect(manifest.main).toBe("./dist/extension.js");
    expect(manifest.scripts.build).toBe(
      "node --experimental-strip-types ./esbuild.config.ts",
    );
    expect(manifest.scripts.format).toBe(
      "pnpm --workspace-root exec biome format --write apps/vscode-extension",
    );
  });

  it("relies on VS Code contribution activation events", () => {
    expect(manifest.activationEvents).toBeUndefined();
  });

  it("contributes the public command ids", () => {
    const contributedCommands = manifest.contributes.commands.map(
      ({ command }) => command,
    );

    expect(contributedCommands).toEqual([
      COMMAND_IDS.openPreview,
      COMMAND_IDS.copyGeneratedHtml,
      COMMAND_IDS.selectTheme,
    ]);
  });

  it("contributes the theme manager view", () => {
    expect(manifest.contributes.viewsContainers.activitybar).toEqual([
      {
        icon: "resources/md-hinagata.svg",
        id: "md-hinagata",
        title: "md-hinagata",
      },
    ]);
    expect(manifest.contributes.views["md-hinagata"]).toEqual([
      {
        icon: "resources/md-hinagata.svg",
        id: THEME_MANAGER_VIEW_ID,
        name: "Theme Manager",
        type: "webview",
      },
    ]);
  });
});
