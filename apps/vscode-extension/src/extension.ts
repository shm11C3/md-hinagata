import * as vscode from "vscode";

import { registerCommands } from "./commands/index.js";
import {
  PREVIEW_PANEL_TITLE,
  PREVIEW_PANEL_VIEW_TYPE,
  PreviewPanel,
} from "./panels/previewPanel.js";
import { DiagnosticsService } from "./services/diagnosticsService.js";
import { DocumentStateService } from "./services/documentStateService.js";
import { ThemeResolver } from "./services/themeResolver.js";
import {
  createWasmModuleLoader,
  TransformService,
} from "./services/transformService.js";
import { WorkspaceTrustService } from "./services/workspaceTrustService.js";
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
  const themeResolver = new ThemeResolver(context.extensionUri);
  const transformService = new TransformService(
    createWasmModuleLoader(context.extensionUri),
  );
  const workspaceTrustService = new WorkspaceTrustService(
    () => vscode.workspace.isTrusted,
  );
  const previewPanel = new PreviewPanel(
    documentStateService,
    transformService,
    {
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
    },
  );
  const themeEditorViewProvider = new ThemeEditorViewProvider(
    documentStateService,
    diagnosticsService,
    workspaceTrustService,
  );

  registerCommands(context, {
    documentStateService,
    previewPanel,
    themeResolver,
    workspaceTrustService,
  });

  context.subscriptions.push(
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
  );
}

export function deactivate(): void {}
