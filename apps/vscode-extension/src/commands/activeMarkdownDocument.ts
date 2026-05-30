export interface TextDocumentLike {
  getText(): string;
  languageId: string;
  uri: {
    toString(): string;
  };
}

export interface ActiveTextEditorLike<
  TDocument extends TextDocumentLike = TextDocumentLike,
> {
  document: TDocument;
}

export interface ActiveWindowLike<
  TDocument extends TextDocumentLike = TextDocumentLike,
> {
  activeTextEditor: ActiveTextEditorLike<TDocument> | undefined;
  visibleTextEditors?: readonly ActiveTextEditorLike<TDocument>[];
  showInformationMessage(message: string): unknown;
}

export interface CurrentMarkdownState {
  markdown?: string;
  status: "active" | "inactive";
  uri?: string;
}

export interface CurrentMarkdownStateService {
  getState(): CurrentMarkdownState;
}

export interface MarkdownDocumentOpener<
  TDocument extends TextDocumentLike = TextDocumentLike,
> {
  openTextDocument(uri: string): Promise<TDocument>;
}

export const MARKDOWN_REQUIRED_MESSAGE =
  "Open a Markdown file to use md-hinagata commands.";

export function getActiveMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(window: ActiveWindowLike<TDocument>): TDocument | undefined {
  const document = getOptionalActiveMarkdownDocument(window);
  if (document !== undefined) {
    return document;
  }

  window.showInformationMessage(MARKDOWN_REQUIRED_MESSAGE);
  return undefined;
}

export function getOptionalActiveMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<ActiveWindowLike<TDocument>, "activeTextEditor">,
): TDocument | undefined {
  const document = window.activeTextEditor?.document;
  if (document?.languageId !== "markdown") {
    return undefined;
  }

  return document;
}

export function getVisibleMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<ActiveWindowLike<TDocument>, "visibleTextEditors">,
): TDocument | undefined {
  const markdownDocumentsByUri = new Map<string, TDocument>();
  for (const editor of window.visibleTextEditors ?? []) {
    const document = editor.document;
    if (document.languageId !== "markdown") {
      continue;
    }

    markdownDocumentsByUri.set(document.uri.toString(), document);
  }

  if (markdownDocumentsByUri.size !== 1) {
    return undefined;
  }

  return [...markdownDocumentsByUri.values()][0];
}

export function hasCurrentMarkdownDocument(
  window: Pick<ActiveWindowLike, "activeTextEditor" | "visibleTextEditors">,
  stateService: CurrentMarkdownStateService,
): boolean {
  return (
    getOptionalActiveMarkdownDocument(window) !== undefined ||
    getVisibleMarkdownDocument(window) !== undefined ||
    hasStoredMarkdownDocument(stateService)
  );
}

export async function openCurrentMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<
    ActiveWindowLike<TDocument>,
    "activeTextEditor" | "visibleTextEditors"
  >,
  stateService: CurrentMarkdownStateService,
  opener: MarkdownDocumentOpener<TDocument>,
): Promise<TDocument | undefined> {
  const activeDocument = getOptionalActiveMarkdownDocument(window);
  if (activeDocument !== undefined) {
    return activeDocument;
  }

  const visibleDocument = getVisibleMarkdownDocument(window);
  if (visibleDocument !== undefined) {
    return visibleDocument;
  }

  const state = stateService.getState();
  if (isStoredMarkdownState(state) && state.uri !== undefined) {
    let storedDocument: TDocument;
    try {
      storedDocument = await opener.openTextDocument(state.uri);
    } catch {
      return undefined;
    }

    if (storedDocument.languageId === "markdown") {
      return storedDocument;
    }
  }

  return undefined;
}

export function hasStoredMarkdownDocument(
  stateService: CurrentMarkdownStateService,
): boolean {
  return isStoredMarkdownState(stateService.getState());
}

export function prepareCurrentMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<
    ActiveWindowLike<TDocument>,
    "activeTextEditor" | "visibleTextEditors"
  >,
  stateService: {
    getState(): CurrentMarkdownState;
    setActiveDocument(document: {
      languageId: string;
      markdown: string;
      uri: string;
    }): unknown;
  },
): boolean {
  const activeDocument = getOptionalActiveMarkdownDocument(window);
  if (activeDocument !== undefined) {
    stateService.setActiveDocument(createDocumentSnapshot(activeDocument));
    return true;
  }

  const visibleDocument = getVisibleMarkdownDocument(window);
  if (visibleDocument !== undefined) {
    stateService.setActiveDocument(createDocumentSnapshot(visibleDocument));
    return true;
  }

  if (hasStoredMarkdownDocument(stateService)) {
    return true;
  }

  return false;
}

function createDocumentSnapshot(document: TextDocumentLike): {
  languageId: string;
  markdown: string;
  uri: string;
} {
  return {
    languageId: document.languageId,
    markdown: document.getText(),
    uri: document.uri.toString(),
  };
}

function isStoredMarkdownState(state: CurrentMarkdownState): boolean {
  return (
    state.status === "active" &&
    state.uri !== undefined &&
    state.markdown !== undefined
  );
}
