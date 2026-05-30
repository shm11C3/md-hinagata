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

export interface CurrentMarkdownDocumentStateService
  extends CurrentMarkdownStateService {
  setActiveDocument(document: {
    languageId: string;
    markdown: string;
    uri: string;
  }): unknown;
}

export interface MarkdownDocumentOpener<
  TDocument extends TextDocumentLike = TextDocumentLike,
> {
  openTextDocument(uri: string): Promise<TDocument>;
}

type VisibleMarkdownDocumentResolution<
  TDocument extends TextDocumentLike = TextDocumentLike,
> =
  | {
      document: TDocument;
      kind: "single";
    }
  | {
      kind: "ambiguous" | "none";
    };

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
  const resolution = resolveVisibleMarkdownDocument(window);
  return resolution.kind === "single" ? resolution.document : undefined;
}

export function prepareCurrentMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<
    ActiveWindowLike<TDocument>,
    "activeTextEditor" | "visibleTextEditors"
  >,
  stateService: CurrentMarkdownDocumentStateService,
): boolean {
  const activeDocument = getOptionalActiveMarkdownDocument(window);
  if (activeDocument !== undefined) {
    setCurrentMarkdownDocument(stateService, activeDocument);
    return true;
  }

  const visibleResolution = resolveVisibleMarkdownDocument(window);
  if (visibleResolution.kind === "single") {
    setCurrentMarkdownDocument(stateService, visibleResolution.document);
    return true;
  }

  if (visibleResolution.kind === "ambiguous") {
    return false;
  }

  return hasStoredMarkdownDocument(stateService);
}

function resolveVisibleMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<ActiveWindowLike<TDocument>, "visibleTextEditors">,
): VisibleMarkdownDocumentResolution<TDocument> {
  const markdownDocumentsByUri = new Map<string, TDocument>();
  for (const editor of window.visibleTextEditors ?? []) {
    const document = editor.document;
    if (document.languageId !== "markdown") {
      continue;
    }

    markdownDocumentsByUri.set(document.uri.toString(), document);
  }

  if (markdownDocumentsByUri.size === 0) {
    return { kind: "none" };
  }

  if (markdownDocumentsByUri.size > 1) {
    return { kind: "ambiguous" };
  }

  return {
    document: [...markdownDocumentsByUri.values()][0],
    kind: "single",
  };
}

export function hasCurrentMarkdownDocument(
  window: Pick<ActiveWindowLike, "activeTextEditor" | "visibleTextEditors">,
  stateService: CurrentMarkdownStateService,
): boolean {
  if (getOptionalActiveMarkdownDocument(window) !== undefined) {
    return true;
  }

  const visibleResolution = resolveVisibleMarkdownDocument(window);
  if (visibleResolution.kind === "single") {
    return true;
  }

  if (visibleResolution.kind === "ambiguous") {
    return false;
  }

  return hasStoredMarkdownDocument(stateService);
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

  const visibleResolution = resolveVisibleMarkdownDocument(window);
  if (visibleResolution.kind === "single") {
    return visibleResolution.document;
  }

  if (visibleResolution.kind === "ambiguous") {
    return undefined;
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

function isStoredMarkdownState(state: CurrentMarkdownState): boolean {
  return (
    state.status === "active" &&
    state.uri !== undefined &&
    state.markdown !== undefined
  );
}

function setCurrentMarkdownDocument<TDocument extends TextDocumentLike>(
  stateService: CurrentMarkdownDocumentStateService,
  document: TDocument,
): void {
  stateService.setActiveDocument({
    languageId: document.languageId,
    markdown: document.getText(),
    uri: document.uri.toString(),
  });
}
