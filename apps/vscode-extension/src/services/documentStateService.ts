import type { Disposable } from "vscode";

import type { DiagnosticMessage } from "./diagnosticsService.js";
import type { ThemeFileReference } from "./themeResolver.js";
import type {
  ParsedFrontmatter,
  TransformDiagnostic,
  TransformResponse,
} from "./transformService.js";

const DEFAULT_THEME_ID = "default";

export type DocumentStateStatus = "active" | "inactive";

export interface ActiveDocumentSnapshot {
  languageId: string;
  markdown: string;
  uri: string;
}

export interface TextDocumentSnapshotSource {
  getText(): string;
  languageId: string;
  uri: {
    toString(): string;
  };
}

export interface DocumentState {
  css?: string;
  currentTheme: string;
  currentThemeFiles: readonly ThemeFileReference[];
  diagnostics: readonly DiagnosticMessage[];
  frontmatter?: ParsedFrontmatter;
  generatedHtml: string;
  isStale: boolean;
  lastTransformedAt?: number;
  markdown?: string;
  resolvedThemeId?: string;
  status: DocumentStateStatus;
  uri?: string;
}

export interface ApplyTransformOptions {
  diagnostics?: readonly DiagnosticMessage[];
  expectedUri?: string;
  themeFiles?: readonly ThemeFileReference[];
  transformedAt?: number;
}

export type DocumentStateListener = (state: DocumentState) => void;

export class DocumentStateService {
  #listeners = new Set<DocumentStateListener>();
  #state = createInactiveState();

  public getState(): DocumentState {
    return cloneDocumentState(this.#state);
  }

  public subscribe(listener: DocumentStateListener): Disposable {
    this.#listeners.add(listener);
    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }

  public setActiveDocument(document: ActiveDocumentSnapshot): DocumentState {
    if (document.languageId !== "markdown") {
      return this.setInactive();
    }

    this.#state = {
      ...this.#state,
      css: undefined,
      currentThemeFiles: [],
      diagnostics: [],
      frontmatter: undefined,
      generatedHtml: "",
      isStale: true,
      lastTransformedAt: undefined,
      markdown: document.markdown,
      resolvedThemeId: undefined,
      status: "active",
      uri: document.uri,
    };
    this.notify();
    return this.getState();
  }

  public updateMarkdown(uri: string, markdown: string): DocumentState {
    if (this.#state.status !== "active" || this.#state.uri !== uri) {
      return this.getState();
    }

    this.#state = {
      ...this.#state,
      isStale: true,
      markdown,
    };
    this.notify();
    return this.getState();
  }

  public applyTransformResult(
    result: TransformResponse,
    options: ApplyTransformOptions = {},
  ): DocumentState {
    if (
      options.expectedUri !== undefined &&
      (this.#state.status !== "active" ||
        this.#state.uri !== options.expectedUri)
    ) {
      return this.getState();
    }

    const frontmatterTheme = result.frontmatter?.theme;
    const currentTheme =
      frontmatterTheme !== undefined && frontmatterTheme.length > 0
        ? frontmatterTheme
        : this.#state.currentTheme;
    const diagnostics = [
      ...(options.diagnostics ?? []),
      ...result.diagnostics.map(transformDiagnosticToMessage),
    ];

    this.#state = {
      ...this.#state,
      css: result.css,
      currentTheme,
      currentThemeFiles: options.themeFiles ?? [],
      diagnostics,
      frontmatter: result.frontmatter,
      generatedHtml: result.html,
      isStale: false,
      lastTransformedAt: options.transformedAt ?? Date.now(),
      resolvedThemeId: result.resolvedThemeId,
    };
    this.notify();
    return this.getState();
  }

  public replaceDiagnostics(
    diagnostics: readonly DiagnosticMessage[],
  ): DocumentState {
    this.#state = {
      ...this.#state,
      diagnostics: diagnostics.map(cloneDiagnosticMessage),
    };
    this.notify();
    return this.getState();
  }

  public setInactive(): DocumentState {
    this.#state = createInactiveState(this.#state.currentTheme);
    this.notify();
    return this.getState();
  }

  public getCurrentTheme(): string {
    return this.#state.currentTheme;
  }

  public setCurrentTheme(themeId: string): void {
    this.#state = {
      ...this.#state,
      currentTheme: themeId,
      isStale: this.#state.status === "active",
    };
    this.notify();
  }

  public getGeneratedHtml(): string {
    return this.#state.generatedHtml;
  }

  public setGeneratedHtml(html: string): void {
    this.#state = {
      ...this.#state,
      generatedHtml: html,
    };
    this.notify();
  }

  public dispose(): void {
    this.#listeners.clear();
    this.#state = createInactiveState();
  }

  private notify(): void {
    for (const listener of this.#listeners) {
      listener(this.getState());
    }
  }
}

export function createActiveDocumentSnapshot(
  document: TextDocumentSnapshotSource,
): ActiveDocumentSnapshot {
  return {
    languageId: document.languageId,
    markdown: document.getText(),
    uri: document.uri.toString(),
  };
}

function createInactiveState(currentTheme = DEFAULT_THEME_ID): DocumentState {
  return {
    currentTheme,
    currentThemeFiles: [],
    diagnostics: [],
    generatedHtml: "",
    isStale: false,
    status: "inactive",
  };
}

function cloneDocumentState(state: DocumentState): DocumentState {
  return {
    ...state,
    currentThemeFiles: state.currentThemeFiles.map(cloneThemeFileReference),
    diagnostics: state.diagnostics.map(cloneDiagnosticMessage),
    frontmatter:
      state.frontmatter === undefined ? undefined : { ...state.frontmatter },
  };
}

function cloneThemeFileReference(file: ThemeFileReference): ThemeFileReference {
  return { ...file };
}

function cloneDiagnosticMessage(
  diagnostic: DiagnosticMessage,
): DiagnosticMessage {
  return { ...diagnostic };
}

function transformDiagnosticToMessage(
  diagnostic: TransformDiagnostic,
): DiagnosticMessage {
  return {
    message:
      diagnostic.code === undefined
        ? diagnostic.message
        : `${diagnostic.code}: ${diagnostic.message}`,
    source: diagnostic.source === "theme" ? "theme" : "transform",
  };
}
