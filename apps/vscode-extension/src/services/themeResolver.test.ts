import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeResolver } from "./themeResolver.js";

describe("ThemeResolver", () => {
  let testRoot: string;
  let extensionRoot: string;
  let workspaceRoot: string;
  let bundledThemeRoot: string;

  beforeEach(async () => {
    testRoot = await mkdtemp(path.join(tmpdir(), "md-hinagata-theme-"));
    extensionRoot = path.join(testRoot, "extension");
    workspaceRoot = path.join(testRoot, "workspace");
    bundledThemeRoot = path.join(extensionRoot, "themes");
    await mkdir(extensionRoot, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(testRoot, { force: true, recursive: true });
  });

  it("loads a bundled theme package from theme.json, CSS, and templates", async () => {
    await writeTheme(path.join(bundledThemeRoot, "default"), {
      css: ".default {}",
      templates: {
        h1: "<h1>{{text}}</h1>",
        p: "<p>{{{inner_html}}}</p>",
      },
    });
    const resolver = new ThemeResolver({ fsPath: extensionRoot });

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: true,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.theme?.source).toBe("bundled");
    expect(result.theme?.themePackage).toMatchObject({
      css: ".default {}",
      id: "default",
      name: "Default",
      source: "bundled",
      templates: {
        h1: "<h1>{{text}}</h1>",
        p: "<p>{{{inner_html}}}</p>",
      },
      version: "0.1.0",
    });
    expect(result.theme?.files.map((file) => file.label)).toEqual([
      "theme.json",
      "styles.css",
      "h1.hbs",
      "p.hbs",
    ]);
  });

  it("loads the repository bundled default theme during local development", async () => {
    const extensionRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
    );
    const resolver = new ThemeResolver({ fsPath: extensionRoot });

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: false,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.theme?.source).toBe("bundled");
    expect(result.theme?.themePackage.id).toBe("default");
    expect(result.theme?.themePackage.templates.h1).toContain("<h1");
  });

  it("reports missing bundled template files", async () => {
    const themeRoot = path.join(bundledThemeRoot, "default");
    await mkdir(path.join(themeRoot, "templates"), { recursive: true });
    await writeFile(path.join(themeRoot, "styles.css"), ".default {}", "utf8");
    await writeFile(
      path.join(themeRoot, "templates", "h1.hbs"),
      "<h1>{{text}}</h1>",
      "utf8",
    );
    await writeFile(
      path.join(themeRoot, "theme.json"),
      `${JSON.stringify({
        entryCss: "styles.css",
        id: "default",
        name: "Default",
        templates: {
          h1: "templates/h1.hbs",
          p: "templates/p.hbs",
        },
        version: "0.1.0",
      })}\n`,
      "utf8",
    );
    const resolver = new ThemeResolver({ fsPath: extensionRoot });

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: false,
    });

    expect(result.theme?.themePackage.templates).toEqual({
      h1: "<h1>{{text}}</h1>",
    });
    expect(result.diagnostics).toEqual([
      {
        message:
          "Bundled theme 'default' is missing template 'templates/p.hbs'.",
        source: "theme",
      },
    ]);
  });

  it("reports invalid bundled theme manifests", async () => {
    const themeRoot = path.join(bundledThemeRoot, "default");
    await mkdir(themeRoot, { recursive: true });
    await writeFile(path.join(themeRoot, "theme.json"), "{", "utf8");
    const resolver = new ThemeResolver({ fsPath: extensionRoot });

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: false,
    });

    expect(result.theme).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        message: expect.stringContaining("Invalid theme manifest"),
        source: "theme",
      },
    ]);
  });

  it("prefers workspace themes when the workspace is trusted", async () => {
    await writeTheme(path.join(bundledThemeRoot, "default"), {
      templates: {
        h1: "<h1>bundled {{text}}</h1>",
      },
    });
    await writeTheme(
      path.join(workspaceRoot, ".md-hinagata", "themes", "default"),
      {
        templates: {
          h1: "<h1>workspace {{text}}</h1>",
        },
      },
    );
    const resolver = new ThemeResolver(
      { fsPath: extensionRoot },
      {
        workspaceFolders: [{ uri: { fsPath: workspaceRoot } }],
      },
    );

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: true,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.theme?.source).toBe("workspace");
    expect(result.theme?.themePackage.templates.h1).toBe(
      "<h1>workspace {{text}}</h1>",
    );
  });

  it("uses bundled themes in untrusted workspaces", async () => {
    await writeTheme(path.join(bundledThemeRoot, "default"), {
      templates: {
        h1: "<h1>bundled {{text}}</h1>",
      },
    });
    await writeTheme(
      path.join(workspaceRoot, ".md-hinagata", "themes", "default"),
      {
        templates: {
          h1: "<h1>workspace {{text}}</h1>",
        },
      },
    );
    const resolver = new ThemeResolver(
      { fsPath: extensionRoot },
      {
        workspaceFolders: [{ uri: { fsPath: workspaceRoot } }],
      },
    );

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: false,
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.theme?.source).toBe("bundled");
    expect(result.theme?.themePackage.templates.h1).toBe(
      "<h1>bundled {{text}}</h1>",
    );
  });

  it("reports a broken workspace theme and falls back to bundled themes", async () => {
    await writeTheme(path.join(bundledThemeRoot, "default"), {
      templates: {
        h1: "<h1>bundled {{text}}</h1>",
      },
    });
    const workspaceThemeRoot = path.join(
      workspaceRoot,
      ".md-hinagata",
      "themes",
      "default",
    );
    await mkdir(workspaceThemeRoot, { recursive: true });
    await writeFile(path.join(workspaceThemeRoot, "theme.json"), "{", "utf8");
    const resolver = new ThemeResolver(
      { fsPath: extensionRoot },
      {
        workspaceFolders: [{ uri: { fsPath: workspaceRoot } }],
      },
    );

    const result = await resolver.resolveTheme("default", {
      isWorkspaceTrusted: true,
    });

    expect(result.theme?.source).toBe("bundled");
    expect(result.diagnostics).toEqual([
      {
        message: expect.stringContaining("Invalid theme manifest"),
        source: "theme",
      },
    ]);
  });

  it("reports missing bundled themes", async () => {
    const resolver = new ThemeResolver({ fsPath: extensionRoot });

    const result = await resolver.resolveTheme("missing", {
      isWorkspaceTrusted: false,
    });

    expect(result.theme).toBeUndefined();
    expect(result.diagnostics).toEqual([
      {
        message: "Bundled theme 'missing' is missing theme.json.",
        source: "theme",
      },
    ]);
  });
});

async function writeTheme(
  themeRoot: string,
  options: {
    css?: string;
    id?: string;
    name?: string;
    templates: Record<string, string>;
  },
) {
  await mkdir(path.join(themeRoot, "templates"), { recursive: true });
  const templates: Record<string, string> = {};
  for (const [key, template] of Object.entries(options.templates)) {
    const templatePath = `templates/${key}.hbs`;
    templates[key] = templatePath;
    await writeFile(path.join(themeRoot, templatePath), template, "utf8");
  }

  await writeFile(
    path.join(themeRoot, "styles.css"),
    options.css ?? ".theme {}",
    "utf8",
  );
  await writeFile(
    path.join(themeRoot, "theme.json"),
    `${JSON.stringify(
      {
        entryCss: "styles.css",
        id: options.id ?? "default",
        name: options.name ?? "Default",
        templates,
        version: "0.1.0",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
