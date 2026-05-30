import type * as vscode from "vscode";
import type { PreviewPanel } from "../panels/previewPanel.js";
import {
  createActiveDocumentSnapshot,
  type DocumentStateService,
} from "../services/documentStateService.js";
import type { DocumentTransformService } from "../services/documentTransformService.js";
import type { ThemeResolver } from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import {
  hasCurrentMarkdownDocument,
  MARKDOWN_REQUIRED_MESSAGE,
  openCurrentMarkdownDocument,
  prepareCurrentMarkdownDocument,
} from "./activeMarkdownDocument.js";
import { COMMAND_IDS } from "./commandIds.js";
import { copyGeneratedHtml } from "./copyGeneratedHtmlCommand.js";
import { createThemeFromDefault } from "./createThemeFromDefaultCommand.js";
import { openThemeFile } from "./openThemeFileCommand.js";
import { selectTheme } from "./selectThemeCommand.js";

export interface CommandDependencies {
  documentStateService: DocumentStateService;
  documentTransformService: Pick<
    DocumentTransformService,
    "refreshActiveDocument"
  >;
  previewPanel: Pick<PreviewPanel, "show">;
  themeResolver: Pick<
    ThemeResolver,
    "canSelectTheme" | "getBundledThemeRoots" | "listSelectableThemes"
  >;
  workspaceTrustService: WorkspaceTrustService;
}

export type VscodeCommandApi = Pick<
  typeof vscode,
  | "commands"
  | "env"
  | "Range"
  | "Uri"
  | "window"
  | "workspace"
  | "WorkspaceEdit"
>;

export function registerCommandsWithApi(
  vscodeApi: VscodeCommandApi,
  context: Pick<vscode.ExtensionContext, "subscriptions">,
  dependencies: CommandDependencies,
): void {
  context.subscriptions.push(
    vscodeApi.commands.registerCommand(COMMAND_IDS.openPreview, () => {
      if (
        !prepareCurrentMarkdownDocument(
          vscodeApi.window,
          dependencies.documentStateService,
        )
      ) {
        vscodeApi.window.showInformationMessage(MARKDOWN_REQUIRED_MESSAGE);
        return undefined;
      }

      dependencies.previewPanel.show();
      return dependencies.documentTransformService.refreshActiveDocument();
    }),
    vscodeApi.commands.registerCommand(COMMAND_IDS.copyGeneratedHtml, () => {
      if (
        !hasCurrentMarkdownDocument(
          vscodeApi.window,
          dependencies.documentStateService,
        )
      ) {
        vscodeApi.window.showInformationMessage(MARKDOWN_REQUIRED_MESSAGE);
        return undefined;
      }

      prepareCurrentMarkdownDocument(
        vscodeApi.window,
        dependencies.documentStateService,
      );

      return copyGeneratedHtml({
        clipboard: vscodeApi.env.clipboard,
        documentStateService: dependencies.documentStateService,
        notifier: vscodeApi.window,
        refreshActiveDocument: () => {
          prepareCurrentMarkdownDocument(
            vscodeApi.window,
            dependencies.documentStateService,
          );
          return dependencies.documentTransformService.refreshActiveDocument();
        },
      });
    }),
    vscodeApi.commands.registerCommand(
      COMMAND_IDS.openThemeFile,
      (filePath: unknown) =>
        openThemeFile(
          dependencies.documentStateService,
          {
            open: async (targetPath) => {
              const document = await vscodeApi.workspace.openTextDocument(
                vscodeApi.Uri.file(targetPath),
              );
              await vscodeApi.window.showTextDocument(document, {
                preview: false,
              });
            },
          },
          filePath,
        ),
    ),
    vscodeApi.commands.registerCommand(
      COMMAND_IDS.selectTheme,
      async (themeId: unknown) => {
        const document = await openCurrentMarkdownDocument(
          vscodeApi.window,
          dependencies.documentStateService,
          {
            openTextDocument: async (uri) =>
              vscodeApi.workspace.openTextDocument(vscodeApi.Uri.parse(uri)),
          },
        );
        if (document === undefined) {
          vscodeApi.window.showInformationMessage(MARKDOWN_REQUIRED_MESSAGE);
          return undefined;
        }

        return selectTheme({
          document: {
            getText: () => document.getText(),
            replaceText: async (source) => {
              const edit = new vscodeApi.WorkspaceEdit();
              edit.replace(
                document.uri,
                new vscodeApi.Range(
                  document.positionAt(0),
                  document.positionAt(document.getText().length),
                ),
                source,
              );
              return vscodeApi.workspace.applyEdit(edit);
            },
          },
          documentStateService: dependencies.documentStateService,
          notifier: vscodeApi.window,
          picker: {
            showQuickPick: async (items, options) =>
              vscodeApi.window.showQuickPick(items, options),
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
    vscodeApi.commands.registerCommand(
      COMMAND_IDS.createThemeFromDefault,
      async (args: unknown) => {
        const document = await openCurrentMarkdownDocument(
          vscodeApi.window,
          dependencies.documentStateService,
          {
            openTextDocument: async (uri) =>
              vscodeApi.workspace.openTextDocument(vscodeApi.Uri.parse(uri)),
          },
        );

        return createThemeFromDefault({
          args,
          defaultThemeRoots: dependencies.themeResolver.getBundledThemeRoots(),
          document:
            document === undefined
              ? undefined
              : {
                  getText: () => document.getText(),
                  replaceText: async (source) => {
                    const edit = new vscodeApi.WorkspaceEdit();
                    edit.replace(
                      document.uri,
                      new vscodeApi.Range(
                        document.positionAt(0),
                        document.positionAt(document.getText().length),
                      ),
                      source,
                    );
                    return vscodeApi.workspace.applyEdit(edit);
                  },
                },
          documentStateService: dependencies.documentStateService,
          fileOpener: {
            open: async (filePath) => {
              const document = await vscodeApi.workspace.openTextDocument(
                vscodeApi.Uri.file(filePath),
              );
              await vscodeApi.window.showTextDocument(document, {
                preview: false,
              });
            },
          },
          notifier: vscodeApi.window,
          picker: {
            showInputBox: async (options) =>
              vscodeApi.window.showInputBox(options),
            showQuickPick: async (items, options) =>
              vscodeApi.window.showQuickPick(items, options),
          },
          refreshActiveDocument: () => {
            if (document === undefined) {
              return Promise.resolve(undefined);
            }

            dependencies.documentStateService.setActiveDocument(
              createActiveDocumentSnapshot(document),
            );
            return dependencies.documentTransformService.refreshActiveDocument();
          },
          workspaceFolders: vscodeApi.workspace.workspaceFolders,
          workspaceTrustService: dependencies.workspaceTrustService,
        });
      },
    ),
  );
}
