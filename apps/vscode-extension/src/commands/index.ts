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
import { openThemeFile } from "./openThemeFileCommand.js";
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

      return copyGeneratedHtml({
        clipboard: vscode.env.clipboard,
        documentStateService: dependencies.documentStateService,
        notifier: vscode.window,
        refreshActiveDocument: () =>
          dependencies.documentTransformService.refreshActiveDocument(),
      });
    }),
    vscode.commands.registerCommand(
      COMMAND_IDS.openThemeFile,
      (filePath: unknown) =>
        openThemeFile(
          dependencies.documentStateService,
          {
            open: async (targetPath) => {
              const document = await vscode.workspace.openTextDocument(
                vscode.Uri.file(targetPath),
              );
              await vscode.window.showTextDocument(document, {
                preview: false,
              });
            },
          },
          filePath,
        ),
    ),
    vscode.commands.registerCommand(
      COMMAND_IDS.selectTheme,
      async (themeId: unknown) => {
        const document = getActiveMarkdownDocument(vscode.window) as
          | vscode.TextDocument
          | undefined;
        if (document === undefined) {
          return undefined;
        }

        return selectTheme({
          document: {
            getText: () => document.getText(),
            replaceText: async (source) => {
              const edit = new vscode.WorkspaceEdit();
              edit.replace(
                document.uri,
                new vscode.Range(
                  document.positionAt(0),
                  document.positionAt(document.getText().length),
                ),
                source,
              );
              return vscode.workspace.applyEdit(edit);
            },
          },
          documentStateService: dependencies.documentStateService,
          notifier: vscode.window,
          picker: {
            showQuickPick: async (items, options) =>
              vscode.window.showQuickPick(items, options),
          },
          refreshActiveDocument: () => {
            dependencies.documentStateService.setActiveDocument(
              createActiveDocumentSnapshot(document),
            );
            return dependencies.documentTransformService.refreshActiveDocument();
          },
          themeId,
          themeResolver: dependencies.themeResolver,
          workspaceTrustService: dependencies.workspaceTrustService,
        });
      },
    ),
  );
}
