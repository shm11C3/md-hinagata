import type { DocumentStateService } from "../services/documentStateService.js";
import type {
  ThemeResolver,
  ThemeSelectionOptions,
} from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";

export function selectTheme(
  documentStateService: DocumentStateService,
  workspaceTrustService: WorkspaceTrustService,
  themeResolver: Pick<ThemeResolver, "canSelectTheme">,
  themeId: unknown,
): string {
  const nextThemeId = normalizeThemeId(themeId);
  if (nextThemeId === undefined) {
    return documentStateService.getCurrentTheme();
  }

  const selectionOptions: ThemeSelectionOptions = {
    isWorkspaceTrusted: workspaceTrustService.isTrusted,
  };
  if (!themeResolver.canSelectTheme(nextThemeId, selectionOptions)) {
    return documentStateService.getCurrentTheme();
  }

  documentStateService.setCurrentTheme(nextThemeId);
  return documentStateService.getCurrentTheme();
}

function normalizeThemeId(themeId: unknown): string | undefined {
  if (typeof themeId !== "string") {
    return undefined;
  }

  const normalizedThemeId = themeId.trim();
  return normalizedThemeId.length > 0 ? normalizedThemeId : undefined;
}
