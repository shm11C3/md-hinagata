import * as vscode from "vscode";
import type { PreviewPanel } from "../panels/previewPanel.js";
import type { DocumentStateService } from "../services/documentStateService.js";
import type { ThemeResolver } from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { getActiveMarkdownDocument } from "./activeMarkdownDocument.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import { openPreview } from "./openPreviewCommand.js";
import { selectTheme } from "./selectThemeCommand.js";

export interface CommandDependencies {
  documentStateService: DocumentStateService;
  previewPanel: PreviewPanel;
  themeResolver: ThemeResolver;
  workspaceTrustService: WorkspaceTrustService;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  dependencies: CommandDependencies,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_IDS.openPreview, () => {
      const document = getActiveMarkdownDocument(vscode.window);
      if (document === undefined) {
        return undefined;
      }

      return openPreview(dependencies.previewPanel, document.getText());
    }),
    vscode.commands.registerCommand(COMMAND_IDS.copyGeneratedHtml, () => {
      const document = getActiveMarkdownDocument(vscode.window);
      if (document === undefined) {
        return undefined;
      }

      return copyGeneratedHtml(
        vscode.env.clipboard,
        dependencies.documentStateService,
      );
    }),
    vscode.commands.registerCommand(
      COMMAND_IDS.selectTheme,
      (themeId: unknown) => {
        const document = getActiveMarkdownDocument(vscode.window);
        if (document === undefined) {
          return undefined;
        }

        return selectTheme(
          dependencies.documentStateService,
          dependencies.workspaceTrustService,
          dependencies.themeResolver,
          themeId,
        );
      },
    ),
  );
}
