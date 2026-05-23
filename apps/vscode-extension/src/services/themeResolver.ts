import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { DiagnosticMessage } from "./diagnosticsService.js";
import type {
  ThemeManifest,
  ThemePackage,
  ThemeSource,
} from "./transformService.js";

export const WORKSPACE_THEME_DIRECTORY = ".md-hinagata/themes";

export interface ThemeResolverUri {
  fsPath: string;
}

export interface ThemeResolverWorkspaceFolder {
  uri: ThemeResolverUri;
}

export interface ThemeSelectionOptions {
  isWorkspaceTrusted: boolean;
}

export interface ThemeResolutionOptions extends ThemeSelectionOptions {
  workspaceFolders?: readonly ThemeResolverWorkspaceFolder[];
}

export interface ThemeResolverOptions {
  bundledThemeRoots?: readonly string[];
  readTextFile?: (filePath: string) => Promise<string>;
  workspaceFolders?:
    | readonly ThemeResolverWorkspaceFolder[]
    | (() => readonly ThemeResolverWorkspaceFolder[] | undefined)
    | undefined;
}

export interface ThemeFileReference {
  kind: "manifest" | "stylesheet" | "template";
  label: string;
  path: string;
  templateKey?: string;
}

export interface SelectableTheme {
  id: string;
  source: ThemeSource;
}

export interface ResolvedTheme {
  files: readonly ThemeFileReference[];
  rootPath: string;
  source: ThemeSource;
  themePackage: ThemePackage;
}

export interface ThemeResolution {
  diagnostics: readonly DiagnosticMessage[];
  theme?: ResolvedTheme;
}

interface ThemeLoadResult extends ThemeResolution {
  manifestFound: boolean;
}

interface ThemeFileReadResult {
  missing: boolean;
  text?: string;
}

export class ThemeResolver {
  readonly #bundledThemeRoots: readonly string[];
  readonly #extensionRootPath: string;
  readonly #readTextFile: (filePath: string) => Promise<string>;
  readonly #workspaceFolders:
    | readonly ThemeResolverWorkspaceFolder[]
    | (() => readonly ThemeResolverWorkspaceFolder[] | undefined)
    | undefined;

  public constructor(
    extensionUri: ThemeResolverUri,
    options: ThemeResolverOptions = {},
  ) {
    this.#extensionRootPath = extensionUri.fsPath;
    this.#bundledThemeRoots =
      options.bundledThemeRoots ?? getDefaultBundledThemeRoots(extensionUri);
    this.#readTextFile = options.readTextFile ?? readTextUtf8;
    this.#workspaceFolders = options.workspaceFolders;
  }

  public getBundledThemeRoot(): string {
    return (
      this.#bundledThemeRoots[0] ?? path.join(this.#extensionRootPath, "themes")
    );
  }

  public getBundledThemeRoots(): readonly string[] {
    return [...this.#bundledThemeRoots];
  }

  public canSelectTheme(
    themeId: string,
    options: ThemeSelectionOptions,
  ): boolean {
    void options;
    return isValidThemeId(themeId);
  }

  public async listSelectableThemes(
    options: ThemeResolutionOptions,
  ): Promise<SelectableTheme[]> {
    const themes: SelectableTheme[] = [];
    const seenThemeIds = new Set<string>();

    if (options.isWorkspaceTrusted) {
      for (const workspaceFolder of this.getWorkspaceFolders(options)) {
        await this.collectThemeDirectories(
          path.join(workspaceFolder.uri.fsPath, WORKSPACE_THEME_DIRECTORY),
          "workspace",
          themes,
          seenThemeIds,
          options,
        );
      }
    }

    for (const bundledThemeRoot of this.#bundledThemeRoots) {
      await this.collectThemeDirectories(
        bundledThemeRoot,
        "bundled",
        themes,
        seenThemeIds,
        options,
      );
    }

    return themes;
  }

  public async resolveTheme(
    themeId: string,
    options: ThemeResolutionOptions,
  ): Promise<ThemeResolution> {
    const diagnostics: DiagnosticMessage[] = [];
    if (!isValidThemeId(themeId)) {
      return {
        diagnostics: [themeDiagnostic(`Invalid theme id '${themeId}'.`)],
      };
    }

    if (options.isWorkspaceTrusted) {
      for (const workspaceFolder of this.getWorkspaceFolders(options)) {
        const workspaceThemeRoot = path.join(
          workspaceFolder.uri.fsPath,
          WORKSPACE_THEME_DIRECTORY,
          themeId,
        );
        const workspaceTheme = await this.loadThemeFromRoot(
          workspaceThemeRoot,
          "workspace",
          themeId,
          false,
        );
        diagnostics.push(...workspaceTheme.diagnostics);
        if (workspaceTheme.theme !== undefined) {
          return {
            diagnostics,
            theme: workspaceTheme.theme,
          };
        }
      }
    }

    let bundledManifestFound = false;
    for (const bundledThemeRoot of this.#bundledThemeRoots) {
      const bundledTheme = await this.loadThemeFromRoot(
        path.join(bundledThemeRoot, themeId),
        "bundled",
        themeId,
        false,
      );
      diagnostics.push(...bundledTheme.diagnostics);
      bundledManifestFound ||= bundledTheme.manifestFound;
      if (bundledTheme.theme !== undefined) {
        return {
          diagnostics,
          theme: bundledTheme.theme,
        };
      }
    }

    if (!bundledManifestFound) {
      diagnostics.push(
        themeDiagnostic(`Bundled theme '${themeId}' is missing theme.json.`),
      );
    }

    return { diagnostics };
  }

  public async loadBundledTheme(themeId = "default"): Promise<ThemeResolution> {
    return this.resolveTheme(themeId, { isWorkspaceTrusted: false });
  }

  public dispose(): void {}

  private getWorkspaceFolders(
    options: ThemeResolutionOptions,
  ): readonly ThemeResolverWorkspaceFolder[] {
    if (options.workspaceFolders !== undefined) {
      return options.workspaceFolders;
    }

    if (typeof this.#workspaceFolders === "function") {
      return this.#workspaceFolders() ?? [];
    }

    return this.#workspaceFolders ?? [];
  }

  private async collectThemeDirectories(
    themeRoot: string,
    source: ThemeSource,
    themes: SelectableTheme[],
    seenThemeIds: Set<string>,
    options: ThemeSelectionOptions,
  ): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await readdir(themeRoot, { withFileTypes: true });
    } catch (error) {
      if (isMissingFileError(error)) {
        return;
      }

      return;
    }

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      if (
        !entry.isDirectory() ||
        seenThemeIds.has(entry.name) ||
        !this.canSelectTheme(entry.name, options)
      ) {
        continue;
      }

      if (
        !(await this.isSelectableThemeDirectory(themeRoot, source, entry.name))
      ) {
        continue;
      }

      themes.push({
        id: entry.name,
        source,
      });
      seenThemeIds.add(entry.name);
    }
  }

  private async isSelectableThemeDirectory(
    themeRoot: string,
    source: ThemeSource,
    themeId: string,
  ): Promise<boolean> {
    const result = await this.loadThemeFromRoot(
      path.join(themeRoot, themeId),
      source,
      themeId,
      false,
    );
    return result.theme !== undefined;
  }

  private async loadThemeFromRoot(
    themeRoot: string,
    source: ThemeSource,
    requestedThemeId: string,
    missingManifestIsDiagnostic: boolean,
  ): Promise<ThemeLoadResult> {
    const diagnostics: DiagnosticMessage[] = [];
    const manifestPath = path.join(themeRoot, "theme.json");
    const manifestRead = await this.readThemeFile(
      manifestPath,
      diagnostics,
      missingManifestIsDiagnostic
        ? `${capitalize(source)} theme '${requestedThemeId}' is missing theme.json.`
        : undefined,
    );

    if (manifestRead.text === undefined) {
      return {
        diagnostics,
        manifestFound: !manifestRead.missing,
      };
    }

    const manifest = parseThemeManifest(
      manifestRead.text,
      manifestPath,
      diagnostics,
    );
    if (manifest === undefined) {
      return {
        diagnostics,
        manifestFound: true,
      };
    }

    if (manifest.id !== requestedThemeId) {
      diagnostics.push(
        themeDiagnostic(
          `${capitalize(source)} theme '${requestedThemeId}' has manifest id '${manifest.id}'.`,
        ),
      );
      return {
        diagnostics,
        manifestFound: true,
      };
    }

    const files: ThemeFileReference[] = [
      {
        kind: "manifest",
        label: "theme.json",
        path: manifestPath,
      },
    ];
    const css = await this.readThemeAsset(
      themeRoot,
      manifest.entryCss,
      diagnostics,
      `${capitalize(source)} theme '${manifest.id}' is missing stylesheet '${manifest.entryCss}'.`,
    );
    if (css !== undefined) {
      files.push({
        kind: "stylesheet",
        label: path.basename(manifest.entryCss),
        path:
          resolveThemeAssetPath(themeRoot, manifest.entryCss, diagnostics) ??
          "",
      });
    }

    const templates: Record<string, string> = {};
    for (const [templateKey, templatePath] of Object.entries(
      manifest.templates,
    )) {
      const template = await this.readThemeAsset(
        themeRoot,
        templatePath,
        diagnostics,
        `${capitalize(source)} theme '${manifest.id}' is missing template '${templatePath}'.`,
      );

      if (template === undefined) {
        continue;
      }

      const resolvedPath = resolveThemeAssetPath(
        themeRoot,
        templatePath,
        diagnostics,
      );
      if (resolvedPath === undefined) {
        continue;
      }

      templates[templateKey] = template;
      files.push({
        kind: "template",
        label: path.basename(templatePath),
        path: resolvedPath,
        templateKey,
      });
    }

    return {
      diagnostics,
      manifestFound: true,
      theme: {
        files: files.filter((file) => file.path.length > 0),
        rootPath: themeRoot,
        source,
        themePackage: {
          css,
          id: manifest.id,
          manifest,
          name: manifest.name,
          source,
          templates,
          version: manifest.version,
        },
      },
    };
  }

  private async readThemeAsset(
    themeRoot: string,
    relativePath: string,
    diagnostics: DiagnosticMessage[],
    missingMessage: string,
  ): Promise<string | undefined> {
    const filePath = resolveThemeAssetPath(
      themeRoot,
      relativePath,
      diagnostics,
    );
    if (filePath === undefined) {
      return undefined;
    }

    return (await this.readThemeFile(filePath, diagnostics, missingMessage))
      .text;
  }

  private async readThemeFile(
    filePath: string,
    diagnostics: DiagnosticMessage[],
    missingMessage: string | undefined,
  ): Promise<ThemeFileReadResult> {
    try {
      return {
        missing: false,
        text: await this.#readTextFile(filePath),
      };
    } catch (error) {
      if (isMissingFileError(error)) {
        if (missingMessage !== undefined) {
          diagnostics.push(themeDiagnostic(missingMessage));
        }
        return { missing: true };
      }

      diagnostics.push(
        themeDiagnostic(
          `Failed to read theme file '${filePath}': ${getErrorMessage(error)}`,
        ),
      );
      return { missing: false };
    }
  }
}

function getDefaultBundledThemeRoots(
  extensionUri: ThemeResolverUri,
): readonly string[] {
  const bundledThemeRoots = [path.join(extensionUri.fsPath, "themes")];
  if (isRepositoryExtensionPackageRoot(extensionUri.fsPath)) {
    bundledThemeRoots.push(
      path.resolve(extensionUri.fsPath, "..", "..", "themes"),
    );
  }

  return uniquePaths(bundledThemeRoots);
}

async function readTextUtf8(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

function parseThemeManifest(
  manifestText: string,
  manifestPath: string,
  diagnostics: DiagnosticMessage[],
): ThemeManifest | undefined {
  let value: unknown;
  try {
    value = JSON.parse(manifestText);
  } catch (error) {
    diagnostics.push(
      themeDiagnostic(
        `Invalid theme manifest '${manifestPath}': ${getErrorMessage(error)}`,
      ),
    );
    return undefined;
  }

  if (!isRecord(value)) {
    diagnostics.push(
      themeDiagnostic(`Invalid theme manifest '${manifestPath}'.`),
    );
    return undefined;
  }

  const templates = parseTemplateMap(
    value.templates,
    manifestPath,
    diagnostics,
  );
  const id = readRequiredString(value, "id", manifestPath, diagnostics);
  const name = readRequiredString(value, "name", manifestPath, diagnostics);
  const version = readRequiredString(
    value,
    "version",
    manifestPath,
    diagnostics,
  );
  const entryCss = readRequiredString(
    value,
    "entryCss",
    manifestPath,
    diagnostics,
  );
  const schemaVersion = readOptionalString(
    value,
    "schemaVersion",
    manifestPath,
    diagnostics,
  );

  if (
    templates === undefined ||
    id === undefined ||
    name === undefined ||
    version === undefined ||
    entryCss === undefined
  ) {
    return undefined;
  }

  return {
    entryCss,
    id,
    name,
    schemaVersion,
    templates,
    version,
  };
}

function parseTemplateMap(
  value: unknown,
  manifestPath: string,
  diagnostics: DiagnosticMessage[],
): Record<string, string> | undefined {
  if (!isRecord(value)) {
    diagnostics.push(
      themeDiagnostic(
        `Invalid theme manifest '${manifestPath}': templates must be an object.`,
      ),
    );
    return undefined;
  }

  const templates: Record<string, string> = {};
  for (const [key, templatePath] of Object.entries(value)) {
    if (typeof templatePath !== "string" || templatePath.trim().length === 0) {
      diagnostics.push(
        themeDiagnostic(
          `Invalid theme manifest '${manifestPath}': templates.${key} must be a non-empty string.`,
        ),
      );
      return undefined;
    }

    templates[key] = templatePath;
  }

  return templates;
}

function readRequiredString(
  value: Record<string, unknown>,
  propertyName: string,
  manifestPath: string,
  diagnostics: DiagnosticMessage[],
): string | undefined {
  const propertyValue = value[propertyName];
  if (typeof propertyValue === "string" && propertyValue.trim().length > 0) {
    return propertyValue;
  }

  diagnostics.push(
    themeDiagnostic(
      `Invalid theme manifest '${manifestPath}': ${propertyName} must be a non-empty string.`,
    ),
  );
  return undefined;
}

function readOptionalString(
  value: Record<string, unknown>,
  propertyName: string,
  manifestPath: string,
  diagnostics: DiagnosticMessage[],
): string | undefined {
  const propertyValue = value[propertyName];
  if (propertyValue === undefined) {
    return undefined;
  }

  if (typeof propertyValue === "string" && propertyValue.trim().length > 0) {
    return propertyValue;
  }

  diagnostics.push(
    themeDiagnostic(
      `Invalid theme manifest '${manifestPath}': ${propertyName} must be a non-empty string when present.`,
    ),
  );
  return undefined;
}

function resolveThemeAssetPath(
  themeRoot: string,
  relativePath: string,
  diagnostics: DiagnosticMessage[],
): string | undefined {
  const resolvedPath = path.resolve(themeRoot, relativePath);
  const resolvedThemeRoot = path.resolve(themeRoot);
  if (
    resolvedPath !== resolvedThemeRoot &&
    !resolvedPath.startsWith(`${resolvedThemeRoot}${path.sep}`)
  ) {
    diagnostics.push(
      themeDiagnostic(
        `Theme asset path '${relativePath}' escapes the theme directory.`,
      ),
    );
    return undefined;
  }

  return resolvedPath;
}

export function isValidThemeId(themeId: string): boolean {
  return (
    themeId.length > 0 &&
    themeId.trim() === themeId &&
    themeId !== "." &&
    themeId !== ".." &&
    !path.isAbsolute(themeId) &&
    !path.win32.isAbsolute(themeId) &&
    !themeId.includes("/") &&
    !themeId.includes("\\")
  );
}

function uniquePaths(paths: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const entry of paths) {
    unique.add(path.resolve(entry));
  }

  return [...unique];
}

function isRepositoryExtensionPackageRoot(extensionRootPath: string): boolean {
  return (
    path.basename(extensionRootPath) === "vscode-extension" &&
    path.basename(path.dirname(extensionRootPath)) === "apps"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return (
    isRecord(error) && (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function themeDiagnostic(message: string): DiagnosticMessage {
  return {
    message,
    source: "theme",
  };
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
