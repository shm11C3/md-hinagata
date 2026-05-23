import {
  cp,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { updateFrontmatterTheme } from "../frontmatter/updateFrontmatter.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import {
  isValidThemeId,
  WORKSPACE_THEME_DIRECTORY,
} from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";

const DEFAULT_THEME_ID = "default";

export interface CreateThemeFromDefaultCommandArgs {
  themeId?: unknown;
  workspaceFolderUri?: unknown;
}

export interface CreateThemeWorkspaceFolder {
  name?: string;
  uri: {
    fsPath: string;
    toString(): string;
  };
}

export interface CreateThemeWorkspaceQuickPickItem {
  description: string;
  label: string;
  workspaceFolder: CreateThemeWorkspaceFolder;
}

export interface CreateThemePicker {
  showInputBox(options: {
    placeHolder: string;
    prompt: string;
    validateInput(value: string): string | undefined;
  }): Promise<string | undefined>;
  showQuickPick(
    items: readonly CreateThemeWorkspaceQuickPickItem[],
    options: {
      placeHolder: string;
    },
  ): Promise<CreateThemeWorkspaceQuickPickItem | undefined>;
}

export interface CreateThemeDocument {
  getText(): string;
  replaceText(source: string): Promise<boolean>;
}

export interface CreateThemeFileOpener {
  open(filePath: string): Promise<void> | void;
}

export interface CreateThemeNotifier {
  showErrorMessage(message: string): unknown;
  showInformationMessage(message: string): unknown;
  showWarningMessage(message: string): unknown;
}

export interface CreateThemeFileSystem {
  copyDirectory(sourcePath: string, targetPath: string): Promise<void>;
  directoryExists(directoryPath: string): Promise<boolean>;
  makeDirectory(directoryPath: string): Promise<void>;
  readTextFile(filePath: string): Promise<string>;
  removeDirectory(directoryPath: string): Promise<void>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  writeTextFile(filePath: string, source: string): Promise<void>;
}

export interface CreateThemeFromDefaultOptions {
  args?: unknown;
  defaultThemeRoots: readonly string[];
  document?: CreateThemeDocument;
  documentStateService: DocumentStateService;
  fileOpener: CreateThemeFileOpener;
  fileSystem?: CreateThemeFileSystem;
  notifier: CreateThemeNotifier;
  picker: CreateThemePicker;
  refreshActiveDocument(): Promise<unknown>;
  workspaceFolders?: readonly CreateThemeWorkspaceFolder[];
  workspaceTrustService: WorkspaceTrustService;
}

interface CreateThemeResult {
  manifestPath: string;
  themeRoot: string;
}

export async function createThemeFromDefault(
  options: CreateThemeFromDefaultOptions,
): Promise<string | undefined> {
  if (!options.workspaceTrustService.isTrusted) {
    options.notifier.showWarningMessage(
      "Workspace themes are disabled in untrusted workspaces. Trust this workspace to create a theme.",
    );
    return undefined;
  }

  const args = normalizeCommandArgs(options.args);
  const workspaceFolder = await resolveWorkspaceFolder(
    options.workspaceFolders ?? [],
    options.picker,
    options.notifier,
    args.workspaceFolderUri,
  );
  if (workspaceFolder === undefined) {
    return undefined;
  }

  const themeId = await resolveThemeId(
    args.themeId,
    options.picker,
    options.notifier,
  );
  if (themeId === undefined) {
    return undefined;
  }

  const themeIdError = validateCreatableThemeId(themeId);
  if (themeIdError !== undefined) {
    options.notifier.showWarningMessage(themeIdError);
    return undefined;
  }

  const fileSystem = options.fileSystem ?? nodeFileSystem;
  let createdTheme: CreateThemeResult;
  try {
    createdTheme = await createWorkspaceTheme({
      defaultThemeRoots: options.defaultThemeRoots,
      fileSystem,
      themeId,
      workspaceFolder,
    });
  } catch (error) {
    options.notifier.showErrorMessage(
      `Failed to create theme '${themeId}': ${getErrorMessage(error)}`,
    );
    return undefined;
  }

  await updateActiveThemeSelection({
    document: options.document,
    documentStateService: options.documentStateService,
    notifier: options.notifier,
    refreshActiveDocument: options.refreshActiveDocument,
    themeId,
  });

  await openCreatedThemeManifest(
    createdTheme.manifestPath,
    options.fileOpener,
    options.notifier,
  );

  options.notifier.showInformationMessage(
    `Created md-hinagata theme '${themeId}'.`,
  );
  return themeId;
}

export function validateCreatableThemeId(themeId: string): string | undefined {
  if (/\s/.test(themeId)) {
    return "Theme ID must not contain whitespace.";
  }

  if (!isValidThemeId(themeId)) {
    return "Theme ID must be a non-empty name, not a path.";
  }

  if (themeId === DEFAULT_THEME_ID) {
    return "Theme ID 'default' is reserved.";
  }

  if (createThemeDisplayName(themeId).length === 0) {
    return "Theme ID must contain a name.";
  }

  return undefined;
}

export function createThemeDisplayName(themeId: string): string {
  return themeId
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeCommandArgs(
  args: unknown,
): Required<CreateThemeFromDefaultCommandArgs> {
  if (!isRecord(args)) {
    return {
      themeId: undefined,
      workspaceFolderUri: undefined,
    };
  }

  return {
    themeId: args.themeId,
    workspaceFolderUri: args.workspaceFolderUri,
  };
}

async function resolveWorkspaceFolder(
  workspaceFolders: readonly CreateThemeWorkspaceFolder[],
  picker: CreateThemePicker,
  notifier: CreateThemeNotifier,
  workspaceFolderUri: unknown,
): Promise<CreateThemeWorkspaceFolder | undefined> {
  if (workspaceFolders.length === 0) {
    notifier.showWarningMessage(
      "Open a workspace folder before creating an md-hinagata theme.",
    );
    return undefined;
  }

  if (workspaceFolderUri !== undefined) {
    if (typeof workspaceFolderUri !== "string") {
      notifier.showWarningMessage("Workspace folder is not available.");
      return undefined;
    }

    const selectedWorkspaceFolder = workspaceFolders.find(
      (workspaceFolder) =>
        workspaceFolder.uri.toString() === workspaceFolderUri ||
        workspaceFolder.uri.fsPath === workspaceFolderUri,
    );
    if (selectedWorkspaceFolder === undefined) {
      notifier.showWarningMessage("Workspace folder is not available.");
      return undefined;
    }

    return selectedWorkspaceFolder;
  }

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0];
  }

  const selected = await picker.showQuickPick(
    workspaceFolders.map(toWorkspaceQuickPickItem),
    {
      placeHolder: "Select a workspace folder for the new md-hinagata theme",
    },
  );
  return selected?.workspaceFolder;
}

async function resolveThemeId(
  themeId: unknown,
  picker: CreateThemePicker,
  notifier: CreateThemeNotifier,
): Promise<string | undefined> {
  if (themeId !== undefined) {
    if (typeof themeId !== "string") {
      notifier.showWarningMessage("Theme ID must be a string.");
      return undefined;
    }

    return themeId;
  }

  return picker.showInputBox({
    placeHolder: "company-blog",
    prompt: "Enter a new md-hinagata theme ID",
    validateInput: validateCreatableThemeId,
  });
}

function toWorkspaceQuickPickItem(
  workspaceFolder: CreateThemeWorkspaceFolder,
): CreateThemeWorkspaceQuickPickItem {
  return {
    description: workspaceFolder.uri.fsPath,
    label: workspaceFolder.name ?? path.basename(workspaceFolder.uri.fsPath),
    workspaceFolder,
  };
}

async function createWorkspaceTheme(options: {
  defaultThemeRoots: readonly string[];
  fileSystem: CreateThemeFileSystem;
  themeId: string;
  workspaceFolder: CreateThemeWorkspaceFolder;
}): Promise<CreateThemeResult> {
  const sourceThemeRoot = await findDefaultThemeRoot(
    options.defaultThemeRoots,
    options.fileSystem,
  );
  if (sourceThemeRoot === undefined) {
    throw new Error("Bundled default theme is not available.");
  }

  const themeParentPath = path.join(
    options.workspaceFolder.uri.fsPath,
    WORKSPACE_THEME_DIRECTORY,
  );
  const themeRoot = path.join(themeParentPath, options.themeId);
  if (await options.fileSystem.directoryExists(themeRoot)) {
    throw new Error(`Theme '${options.themeId}' already exists.`);
  }

  await options.fileSystem.makeDirectory(themeParentPath);
  const temporaryThemeRoot = path.join(
    themeParentPath,
    `.${options.themeId}.tmp-${Date.now()}-${process.pid}`,
  );

  try {
    await options.fileSystem.copyDirectory(sourceThemeRoot, temporaryThemeRoot);
    await rewriteThemeManifest(
      temporaryThemeRoot,
      options.themeId,
      options.fileSystem,
    );
    await options.fileSystem.rename(temporaryThemeRoot, themeRoot);
  } catch (error) {
    await options.fileSystem.removeDirectory(temporaryThemeRoot);
    throw error;
  }

  return {
    manifestPath: path.join(themeRoot, "theme.json"),
    themeRoot,
  };
}

async function findDefaultThemeRoot(
  defaultThemeRoots: readonly string[],
  fileSystem: CreateThemeFileSystem,
): Promise<string | undefined> {
  for (const defaultThemeRoot of defaultThemeRoots) {
    const candidate = path.join(defaultThemeRoot, DEFAULT_THEME_ID);
    if (await fileSystem.directoryExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function rewriteThemeManifest(
  themeRoot: string,
  themeId: string,
  fileSystem: CreateThemeFileSystem,
): Promise<void> {
  const manifestPath = path.join(themeRoot, "theme.json");
  const manifestValue = JSON.parse(await fileSystem.readTextFile(manifestPath));
  if (!isRecord(manifestValue)) {
    throw new Error("Default theme manifest must be a JSON object.");
  }

  manifestValue.id = themeId;
  manifestValue.name = createThemeDisplayName(themeId);
  await fileSystem.writeTextFile(
    manifestPath,
    `${JSON.stringify(manifestValue, null, 2)}\n`,
  );
}

async function updateActiveThemeSelection(options: {
  document: CreateThemeDocument | undefined;
  documentStateService: DocumentStateService;
  notifier: CreateThemeNotifier;
  refreshActiveDocument(): Promise<unknown>;
  themeId: string;
}): Promise<void> {
  if (options.document === undefined) {
    return;
  }

  const updatedFrontmatter = updateFrontmatterTheme({
    source: options.document.getText(),
    themeId: options.themeId,
  });
  if (!updatedFrontmatter.ok) {
    options.notifier.showWarningMessage(
      `Theme was created, but the active document could not be updated: ${updatedFrontmatter.reason}`,
    );
    return;
  }

  const didUpdate = await options.document.replaceText(
    updatedFrontmatter.source,
  );
  if (!didUpdate) {
    options.notifier.showWarningMessage(
      "Theme was created, but the active document could not be updated.",
    );
    return;
  }

  options.documentStateService.setCurrentTheme(options.themeId);
  await options.refreshActiveDocument();
}

async function openCreatedThemeManifest(
  manifestPath: string,
  fileOpener: CreateThemeFileOpener,
  notifier: CreateThemeNotifier,
): Promise<void> {
  try {
    await fileOpener.open(manifestPath);
  } catch (error) {
    notifier.showWarningMessage(
      `Theme was created, but theme.json could not be opened: ${getErrorMessage(error)}`,
    );
  }
}

const nodeFileSystem: CreateThemeFileSystem = {
  copyDirectory: (sourcePath, targetPath) =>
    cp(sourcePath, targetPath, { recursive: true }),
  directoryExists: async (directoryPath) => {
    try {
      return (await stat(directoryPath)).isDirectory();
    } catch (error) {
      if (isMissingFileError(error)) {
        return false;
      }

      throw error;
    }
  },
  makeDirectory: async (directoryPath) => {
    await mkdir(directoryPath, { recursive: true });
  },
  readTextFile: (filePath) => readFile(filePath, "utf8"),
  removeDirectory: (directoryPath) =>
    rm(directoryPath, { force: true, recursive: true }),
  rename,
  writeTextFile: (filePath, source) => writeFile(filePath, source, "utf8"),
};

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
