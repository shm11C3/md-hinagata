import type { DocumentStateService } from "../services/documentStateService.js";

export interface ClipboardLike {
  writeText(value: string): void | PromiseLike<void>;
}

export async function copyGeneratedHtml(
  clipboard: ClipboardLike,
  documentStateService: DocumentStateService,
): Promise<void> {
  await clipboard.writeText(documentStateService.getGeneratedHtml());
}
