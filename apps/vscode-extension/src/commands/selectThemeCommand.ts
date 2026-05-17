import type { DocumentStateService } from "../services/documentStateService.js";

export function selectTheme(
  documentStateService: DocumentStateService,
  themeId: unknown,
): string {
  if (typeof themeId === "string" && themeId.trim().length > 0) {
    documentStateService.setCurrentTheme(themeId.trim());
  }

  return documentStateService.getCurrentTheme();
}
