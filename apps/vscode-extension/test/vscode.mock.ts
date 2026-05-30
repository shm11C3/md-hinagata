// Minimal stand-in for the `vscode` module so source files that import it
// directly can be exercised under Vitest. Aliased to `vscode` in
// `vitest.config.ts`. Tests drive behavior through the exported `vscodeMock`
// control surface and reset it with `resetVscodeMock()`.
//
// Exported objects carry explicit type annotations so their inferred types do
// not leak Vitest's internal `Procedure` type into declaration output (ts2883).
import { type Mock, vi } from "vitest";

export interface Disposable {
  dispose: () => void;
}

type Listener<T> = (value: T) => void;

interface Emitter<T> {
  event: (listener: Listener<T>) => Disposable;
  fire: (value: T) => void;
  listeners: Array<Listener<T>>;
}

function createEmitter<T>(): Emitter<T> {
  const listeners: Array<Listener<T>> = [];
  return {
    listeners,
    event(listener) {
      listeners.push(listener);
      return {
        dispose() {
          const index = listeners.indexOf(listener);
          if (index >= 0) {
            listeners.splice(index, 1);
          }
        },
      };
    },
    fire(value) {
      for (const listener of [...listeners]) {
        listener(value);
      }
    },
  };
}

export const ViewColumn = {
  Active: -1,
  Beside: -2,
  One: 1,
  Two: 2,
} as const;

export const CompletionItemKind = {
  Property: 9,
  Value: 11,
  Snippet: 14,
} as const;

export class Position {
  public constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  public constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class CompletionItem {
  public detail: string | undefined;
  public insertText: unknown;
  public sortText: string | undefined;

  public constructor(
    public readonly label: string,
    public readonly kind: number,
  ) {}
}

export class SnippetString {
  public constructor(public readonly value: string) {}
}

export class WorkspaceEdit {
  public readonly replacements: Array<{
    uri: unknown;
    range: unknown;
    source: string;
  }> = [];

  public replace(uri: unknown, range: unknown, source: string): void {
    this.replacements.push({ uri, range, source });
  }
}

interface MockUri {
  fsPath: string;
  scheme: string;
  toString: () => string;
}

export const Uri: {
  file: (fsPath: string) => MockUri;
  parse: (value: string) => MockUri;
} = {
  file: (fsPath: string) => ({
    fsPath,
    scheme: "file",
    toString: () => `file://${fsPath}`,
  }),
  parse: (value: string) => ({
    fsPath: value,
    scheme: value.split(":")[0] ?? "",
    toString: () => value,
  }),
};

interface VscodeMockState {
  activeTextEditor: unknown;
  visibleTextEditors: unknown[];
  workspaceFolders: unknown;
  isTrusted: boolean;
  onDidChangeActiveTextEditor: Emitter<unknown>;
  onDidChangeTextDocument: Emitter<unknown>;
  onDidSaveTextDocument: Emitter<unknown>;
  registeredCommands: Map<string, (...args: unknown[]) => unknown>;
  completionProviders: Array<{
    selector: unknown;
    provider: unknown;
    triggers: string[];
  }>;
  webviewViewProviders: Map<string, unknown>;
  clipboardText: string;
}

function createState(): VscodeMockState {
  return {
    activeTextEditor: undefined,
    visibleTextEditors: [],
    workspaceFolders: undefined,
    isTrusted: true,
    onDidChangeActiveTextEditor: createEmitter(),
    onDidChangeTextDocument: createEmitter(),
    onDidSaveTextDocument: createEmitter(),
    registeredCommands: new Map(),
    completionProviders: [],
    webviewViewProviders: new Map(),
    clipboardText: "",
  };
}

const state = createState();

export const vscodeMock: {
  state: VscodeMockState;
  fireActiveTextEditorChange: (editor: unknown) => void;
  fireTextDocumentChange: (event: unknown) => void;
  fireSaveTextDocument: (document: unknown) => void;
} = {
  state,
  fireActiveTextEditorChange(editor) {
    state.onDidChangeActiveTextEditor.fire(editor);
  },
  fireTextDocumentChange(event) {
    state.onDidChangeTextDocument.fire(event);
  },
  fireSaveTextDocument(document) {
    state.onDidSaveTextDocument.fire(document);
  },
};

export function resetVscodeMock(): void {
  Object.assign(state, createState());
  vi.clearAllMocks();
}

interface WindowMock {
  readonly activeTextEditor: unknown;
  readonly visibleTextEditors: unknown[];
  showInformationMessage: Mock;
  showWarningMessage: Mock;
  showErrorMessage: Mock;
  showQuickPick: Mock;
  showInputBox: Mock;
  showTextDocument: Mock;
  createWebviewPanel: Mock;
  registerWebviewViewProvider: Mock;
  onDidChangeActiveTextEditor: (listener: Listener<unknown>) => Disposable;
  tabGroups: { all: unknown[]; close: Mock };
}

export const window: WindowMock = {
  get activeTextEditor() {
    return state.activeTextEditor;
  },
  get visibleTextEditors() {
    return state.visibleTextEditors;
  },
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showTextDocument: vi.fn(),
  createWebviewPanel: vi.fn(() => ({
    webview: { html: "" },
    onDidDispose: createEmitter().event,
    reveal: vi.fn(),
    dispose: vi.fn(),
  })),
  registerWebviewViewProvider: vi.fn((id: string, provider: unknown) => {
    state.webviewViewProviders.set(id, provider);
    return { dispose: vi.fn() };
  }),
  onDidChangeActiveTextEditor: (listener) =>
    state.onDidChangeActiveTextEditor.event(listener),
  tabGroups: {
    all: [],
    close: vi.fn(),
  },
};

interface WorkspaceMock {
  readonly workspaceFolders: unknown;
  readonly isTrusted: boolean;
  openTextDocument: Mock;
  applyEdit: Mock;
  onDidChangeTextDocument: (listener: Listener<unknown>) => Disposable;
  onDidSaveTextDocument: (listener: Listener<unknown>) => Disposable;
}

export const workspace: WorkspaceMock = {
  get workspaceFolders() {
    return state.workspaceFolders;
  },
  get isTrusted() {
    return state.isTrusted;
  },
  openTextDocument: vi.fn(),
  applyEdit: vi.fn(async () => true),
  onDidChangeTextDocument: (listener) =>
    state.onDidChangeTextDocument.event(listener),
  onDidSaveTextDocument: (listener) =>
    state.onDidSaveTextDocument.event(listener),
};

interface CommandsMock {
  registerCommand: Mock;
  executeCommand: Mock;
  getCommands: Mock;
}

export const commands: CommandsMock = {
  registerCommand: vi.fn(
    (id: string, handler: (...args: unknown[]) => unknown) => {
      state.registeredCommands.set(id, handler);
      return { dispose: vi.fn() };
    },
  ),
  executeCommand: vi.fn(),
  getCommands: vi.fn(async () => [...state.registeredCommands.keys()]),
};

interface LanguagesMock {
  registerCompletionItemProvider: Mock;
}

export const languages: LanguagesMock = {
  registerCompletionItemProvider: vi.fn(
    (selector: unknown, provider: unknown, ...triggers: string[]) => {
      state.completionProviders.push({ selector, provider, triggers });
      return { dispose: vi.fn() };
    },
  ),
};

interface EnvMock {
  clipboard: { writeText: Mock; readText: Mock };
}

export const env: EnvMock = {
  clipboard: {
    writeText: vi.fn(async (value: string) => {
      state.clipboardText = value;
    }),
    readText: vi.fn(async () => state.clipboardText),
  },
};

interface ExtensionsMock {
  all: unknown[];
  getExtension: Mock;
}

export const extensions: ExtensionsMock = {
  all: [],
  getExtension: vi.fn(),
};

export default {
  ViewColumn,
  CompletionItemKind,
  Position,
  Range,
  CompletionItem,
  SnippetString,
  WorkspaceEdit,
  Uri,
  window,
  workspace,
  commands,
  languages,
  env,
  extensions,
};
