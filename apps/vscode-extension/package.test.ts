import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { COMMAND_IDS } from "./src/commands/commandIds.js";
import { THEME_MANAGER_VIEW_ID } from "./src/views/themeEditorViewProvider.js";

interface ExtensionManifest {
  activationEvents?: string[];
  capabilities?: {
    untrustedWorkspaces?: {
      description?: string;
      restrictedConfigurations?: string[];
      supported: "limited" | boolean;
    };
  };
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
  license: string;
  main: string;
  scripts: Record<string, string>;
}

interface RootPackage {
  scripts: Record<string, string>;
}

const manifest = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as ExtensionManifest;

const rootPackage = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as RootPackage;

describe("extension manifest", () => {
  it("targets the current VS Code API baseline", () => {
    expect(manifest.engines.vscode).toBe("^1.120.0");
  });

  it("points to the bundled extension entrypoint", () => {
    expect(manifest.main).toBe("./dist/extension.js");
    expect(manifest.scripts.build).toBe(
      "node --experimental-strip-types ./esbuild.config.ts",
    );
    expect(manifest.scripts.bench).toBe("vitest bench");
    expect(rootPackage.scripts.bench).toBe(
      "pnpm --filter md-hinagata-vscode-extension run bench",
    );
    expect(manifest.scripts["build:release"]).toBe(
      "node --experimental-strip-types ./esbuild.config.ts --release",
    );
    expect(rootPackage.scripts["build:release"]).toBe(
      "pnpm --filter md-hinagata-vscode-extension run build:release",
    );
    expect(manifest.scripts.format).toBe(
      "pnpm --workspace-root exec biome format --write apps/vscode-extension",
    );
  });

  it("syncs Marketplace license files before VSCE packaging", () => {
    expect(manifest.license).toBe("MIT OR Apache-2.0");
    expect(manifest.scripts["vscode:prepublish"]).toBe(
      "pnpm --workspace-root run prepare:vscode-extension-package",
    );
    expect(rootPackage.scripts["prepare:vscode-extension-package"]).toBe(
      "node scripts/sync-vscode-extension-license.mjs",
    );
  });

  it("activates for Markdown documents so frontmatter completion can register", () => {
    expect(manifest.activationEvents).toEqual(["onLanguage:markdown"]);
  });

  it("contributes the public command ids", () => {
    const contributedCommands = manifest.contributes.commands.map(
      ({ command }) => command,
    );

    expect(contributedCommands).toEqual([
      COMMAND_IDS.openPreview,
      COMMAND_IDS.copyGeneratedHtml,
      COMMAND_IDS.selectTheme,
      COMMAND_IDS.createThemeFromDefault,
    ]);
  });

  it("declares limited untrusted workspace support", () => {
    const untrustedWorkspaces = manifest.capabilities?.untrustedWorkspaces;

    expect(untrustedWorkspaces).toBeDefined();
    expect(untrustedWorkspaces?.supported).toBe("limited");
    expect(untrustedWorkspaces?.description).toMatch(/workspace themes/i);
    expect(untrustedWorkspaces?.description).toMatch(/untrusted workspaces/i);
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
