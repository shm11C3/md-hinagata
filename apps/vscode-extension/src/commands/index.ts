import * as vscode from "vscode";
import type { PreviewPanel } from "../panels/previewPanel.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import { openPreview } from "./openPreviewCommand.js";
import { selectTheme } from "./selectThemeCommand.js";

export interface CommandDependencies {
  documentStateService: DocumentStateService;
  previewPanel: PreviewPanel;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  dependencies: CommandDependencies,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_IDS.openPreview, () =>
      openPreview(dependencies.previewPanel),
    ),
    vscode.commands.registerCommand(COMMAND_IDS.copyGeneratedHtml, () =>
      copyGeneratedHtml(
        vscode.env.clipboard,
        dependencies.documentStateService,
      ),
    ),
    vscode.commands.registerCommand(
      COMMAND_IDS.selectTheme,
      (themeId: unknown) =>
        selectTheme(dependencies.documentStateService, themeId),
    ),
  );
}
