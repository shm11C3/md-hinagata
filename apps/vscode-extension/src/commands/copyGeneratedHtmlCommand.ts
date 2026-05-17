import type {
  DocumentState,
  DocumentStateService,
} from "../services/documentStateService.js";

export interface ClipboardLike {
  writeText(value: string): void | PromiseLike<void>;
}

export interface CopyGeneratedHtmlNotifier {
  showErrorMessage(message: string): unknown;
  showInformationMessage(message: string): unknown;
}

export interface CopyGeneratedHtmlOptions {
  clipboard: ClipboardLike;
  documentStateService: DocumentStateService;
  notifier: CopyGeneratedHtmlNotifier;
  refreshActiveDocument(): Promise<DocumentState>;
}

export async function copyGeneratedHtml(
  options: CopyGeneratedHtmlOptions,
): Promise<boolean> {
  try {
    let state = options.documentStateService.getState();
    if (state.status !== "active") {
      options.notifier.showErrorMessage(
        "Open a Markdown file before copying generated HTML.",
      );
      return false;
    }

    if (state.isStale || state.lastTransformedAt === undefined) {
      state = await options.refreshActiveDocument();
    }

    if (state.status !== "active") {
      options.notifier.showErrorMessage(
        "Generated HTML is not available for the current document.",
      );
      return false;
    }

    await options.clipboard.writeText(state.generatedHtml);
    options.notifier.showInformationMessage("Generated HTML copied.");
    return true;
  } catch (error) {
    options.notifier.showErrorMessage(
      `Failed to copy generated HTML: ${getErrorMessage(error)}`,
    );
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
