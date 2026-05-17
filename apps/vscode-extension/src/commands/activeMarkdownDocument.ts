export interface TextDocumentLike {
  getText(): string;
  languageId: string;
  uri: {
    toString(): string;
  };
}

export interface ActiveTextEditorLike {
  document: TextDocumentLike;
}

export interface ActiveWindowLike {
  activeTextEditor: ActiveTextEditorLike | undefined;
  showInformationMessage(message: string): unknown;
}

export const MARKDOWN_REQUIRED_MESSAGE =
  "Open a Markdown file to use md-hinagata commands.";

export function getActiveMarkdownDocument(
  window: ActiveWindowLike,
): TextDocumentLike | undefined {
  const document = window.activeTextEditor?.document;
  if (document?.languageId === "markdown") {
    return document;
  }

  window.showInformationMessage(MARKDOWN_REQUIRED_MESSAGE);
  return undefined;
}
