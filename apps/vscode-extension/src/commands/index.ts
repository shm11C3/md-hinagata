import * as vscode from "vscode";
import type { PreviewPanel } from "../panels/previewPanel.js";
import {
  createActiveDocumentSnapshot,
  type DocumentStateService,
} from "../services/documentStateService.js";
import type { DocumentTransformService } from "../services/documentTransformService.js";
import type { ThemeResolver } from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { getActiveMarkdownDocument } from "./activeMarkdownDocument.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import { selectTheme } from "./selectThemeCommand.js";

export interface CommandDependencies {
  documentStateService: DocumentStateService;
  documentTransformService: DocumentTransformService;
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

      dependencies.documentStateService.setActiveDocument(
        createActiveDocumentSnapshot(document),
      );
      dependencies.previewPanel.show();
      return dependencies.documentTransformService.refreshActiveDocument();
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
