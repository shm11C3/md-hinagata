import type { DocumentStateService } from "../services/documentStateService.js";

export interface ThemeFileOpener {
  open(filePath: string): Promise<void> | void;
}

export async function openThemeFile(
  documentStateService: DocumentStateService,
  fileOpener: ThemeFileOpener,
  filePath: unknown,
): Promise<boolean> {
  if (typeof filePath !== "string") {
    return false;
  }

  const state = documentStateService.getState();
  const isCurrentThemeFile = state.currentThemeFiles.some(
    (file) => file.path === filePath,
  );
  if (!isCurrentThemeFile) {
    return false;
  }

  try {
    await fileOpener.open(filePath);
    return true;
  } catch {
    return false;
  }
}
