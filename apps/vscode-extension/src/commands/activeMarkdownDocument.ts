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

export function hasCurrentMarkdownDocument(
  window: Pick<ActiveWindowLike, "activeTextEditor">,
  stateService: CurrentMarkdownStateService,
): boolean {
  return (
    getOptionalActiveMarkdownDocument(window) !== undefined ||
    hasStoredMarkdownDocument(stateService)
  );
}

export async function openCurrentMarkdownDocument<
  TDocument extends TextDocumentLike = TextDocumentLike,
>(
  window: Pick<ActiveWindowLike<TDocument>, "activeTextEditor">,
  stateService: CurrentMarkdownStateService,
  opener: MarkdownDocumentOpener<TDocument>,
): Promise<TDocument | undefined> {
  const activeDocument = getOptionalActiveMarkdownDocument(window);
  if (activeDocument !== undefined) {
    return activeDocument;
  }

  const state = stateService.getState();
  if (!hasStoredMarkdownDocument(stateService) || state.uri === undefined) {
    return undefined;
  }

  let storedDocument: TDocument;
  try {
    storedDocument = await opener.openTextDocument(state.uri);
  } catch {
    return undefined;
  }

  return storedDocument.languageId === "markdown" ? storedDocument : undefined;
}

function hasStoredMarkdownDocument(
  stateService: CurrentMarkdownStateService,
): boolean {
  const state = stateService.getState();
  return (
    state.status === "active" &&
    state.uri !== undefined &&
    state.markdown !== undefined
  );
}
