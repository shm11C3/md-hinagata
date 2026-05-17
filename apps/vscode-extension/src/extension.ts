import * as vscode from "vscode";

import { registerCommands } from "./commands/index.js";
import {
  PREVIEW_PANEL_TITLE,
  PREVIEW_PANEL_VIEW_TYPE,
  PreviewPanel,
} from "./panels/previewPanel.js";
import { updateActiveEditorState } from "./services/activeEditorState.js";
import { DiagnosticsService } from "./services/diagnosticsService.js";
import { DocumentStateService } from "./services/documentStateService.js";
import { DocumentTransformService } from "./services/documentTransformService.js";
import { ThemeResolver } from "./services/themeResolver.js";
import {
  createWasmModuleLoader,
  TransformService,
} from "./services/transformService.js";
import { WorkspaceTrustService } from "./services/workspaceTrustService.js";
import { debounce } from "./utils/debounce.js";
import {
  THEME_MANAGER_VIEW_ID,
  ThemeEditorViewProvider,
} from "./views/themeEditorViewProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  const previewMediaRoot = vscode.Uri.joinPath(
    context.extensionUri,
    "media",
    "preview",
  );
  const documentStateService = new DocumentStateService();
  const diagnosticsService = new DiagnosticsService();
  const themeResolver = new ThemeResolver(context.extensionUri, {
    workspaceFolders: () => vscode.workspace.workspaceFolders,
  });
  const transformService = new TransformService(
    createWasmModuleLoader(context.extensionUri),
  );
  const workspaceTrustService = new WorkspaceTrustService(
    () => vscode.workspace.isTrusted,
  );
  const documentTransformService = new DocumentTransformService(
    documentStateService,
    themeResolver,
    transformService,
    workspaceTrustService,
  );
  const previewPanel = new PreviewPanel(documentStateService, {
    createPanel: () =>
      vscode.window.createWebviewPanel(
        PREVIEW_PANEL_VIEW_TYPE,
        PREVIEW_PANEL_TITLE,
        vscode.ViewColumn.Beside,
        {
          enableScripts: false,
          localResourceRoots: [previewMediaRoot],
          retainContextWhenHidden: true,
        },
      ),
    resolveStylesheetUri: (webview) =>
      webview
        .asWebviewUri(vscode.Uri.joinPath(previewMediaRoot, "styles.css"))
        .toString(),
    revealPanel: (panel) => {
      panel.reveal(vscode.ViewColumn.Beside);
    },
  });
  const themeEditorViewProvider = new ThemeEditorViewProvider(
    documentStateService,
    diagnosticsService,
    workspaceTrustService,
  );

  registerCommands(context, {
    documentStateService,
    documentTransformService,
    previewPanel,
    themeResolver,
    workspaceTrustService,
  });
  updateActiveEditorState(documentStateService, vscode.window.activeTextEditor);
  void documentTransformService.refreshActiveDocument();

  const refreshActiveDocument = (): void => {
    void documentTransformService.refreshActiveDocument();
  };
  const debouncedRefreshActiveDocument = debounce(refreshActiveDocument, 150);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateActiveEditorState(documentStateService, editor);
      refreshActiveDocument();
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        !isActiveMarkdownDocumentChange(documentStateService, event.document)
      ) {
        return;
      }

      documentStateService.updateMarkdown(
        event.document.uri.toString(),
        event.document.getText(),
      );
      debouncedRefreshActiveDocument();
    }),
    vscode.window.registerWebviewViewProvider(
      THEME_MANAGER_VIEW_ID,
      themeEditorViewProvider,
    ),
    documentStateService,
    diagnosticsService,
    themeResolver,
    transformService,
    workspaceTrustService,
    previewPanel,
    themeEditorViewProvider,
  );
}

export function deactivate(): void {}

function isActiveMarkdownDocumentChange(
  documentStateService: DocumentStateService,
  document: vscode.TextDocument,
): boolean {
  if (document.languageId !== "markdown") {
    return false;
  }

  const state = documentStateService.getState();
  return state.status === "active" && state.uri === document.uri.toString();
}
