import { updateFrontmatterTheme } from "../frontmatter/updateFrontmatter.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import type {
  SelectableTheme,
  ThemeResolver,
  ThemeSelectionOptions,
} from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";

export interface ThemeQuickPickItem {
  description?: string;
  label: string;
  themeId: string;
}

export interface ThemePicker {
  showQuickPick(
    items: readonly ThemeQuickPickItem[],
    options: {
      placeHolder: string;
    },
  ): Promise<ThemeQuickPickItem | undefined>;
}

export interface ThemeSelectionDocument {
  getText(): string;
  replaceText(source: string): Promise<boolean>;
}

export interface ThemeSelectionNotifier {
  showInformationMessage(message: string): unknown;
  showWarningMessage(message: string): unknown;
}

export interface SelectThemeOptions {
  document: ThemeSelectionDocument;
  documentStateService: DocumentStateService;
  picker: ThemePicker;
  refreshActiveDocument(): Promise<unknown>;
  themeId?: unknown;
  themeResolver: Pick<ThemeResolver, "canSelectTheme" | "listSelectableThemes">;
  notifier: ThemeSelectionNotifier;
  workspaceTrustService: WorkspaceTrustService;
}

export async function selectTheme(
  options: SelectThemeOptions,
): Promise<string | undefined> {
  const selectionOptions: ThemeSelectionOptions = {
    isWorkspaceTrusted: options.workspaceTrustService.isTrusted,
  };
  const nextThemeId =
    normalizeThemeId(options.themeId) ??
    (await pickThemeId(
      options.themeResolver,
      options.picker,
      options.notifier,
      selectionOptions,
    ));

  if (nextThemeId === undefined) {
    return options.documentStateService.getCurrentTheme();
  }

  if (!options.themeResolver.canSelectTheme(nextThemeId, selectionOptions)) {
    options.notifier.showWarningMessage(
      `Theme '${nextThemeId}' is not available.`,
    );
    return options.documentStateService.getCurrentTheme();
  }

  const updatedFrontmatter = updateFrontmatterTheme({
    source: options.document.getText(),
    themeId: nextThemeId,
  });
  if (!updatedFrontmatter.ok) {
    options.notifier.showWarningMessage(
      `Could not update frontmatter: ${updatedFrontmatter.reason}`,
    );
    return options.documentStateService.getCurrentTheme();
  }

  const didUpdate = await options.document.replaceText(
    updatedFrontmatter.source,
  );
  if (!didUpdate) {
    options.notifier.showWarningMessage(
      "Could not update the active Markdown document.",
    );
    return options.documentStateService.getCurrentTheme();
  }

  options.documentStateService.setCurrentTheme(nextThemeId);
  await options.refreshActiveDocument();
  options.notifier.showInformationMessage(
    `Selected md-hinagata theme '${nextThemeId}'.`,
  );
  return nextThemeId;
}

async function pickThemeId(
  themeResolver: Pick<ThemeResolver, "listSelectableThemes">,
  picker: ThemePicker,
  notifier: ThemeSelectionNotifier,
  selectionOptions: ThemeSelectionOptions,
): Promise<string | undefined> {
  const themes = await themeResolver.listSelectableThemes(selectionOptions);
  if (themes.length === 0) {
    notifier.showInformationMessage("No md-hinagata themes are available.");
    return undefined;
  }

  const selected = await picker.showQuickPick(themes.map(toQuickPickItem), {
    placeHolder: "Select an md-hinagata theme",
  });

  return selected?.themeId;
}

function toQuickPickItem(theme: SelectableTheme): ThemeQuickPickItem {
  return {
    description: theme.source,
    label: theme.id,
    themeId: theme.id,
  };
}

function normalizeThemeId(themeId: unknown): string | undefined {
  if (typeof themeId !== "string") {
    return undefined;
  }

  const normalizedThemeId = themeId.trim();
  return normalizedThemeId.length > 0 ? normalizedThemeId : undefined;
}
