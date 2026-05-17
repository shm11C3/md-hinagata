import * as vscode from "vscode";

import { registerCommands } from "./commands/index.js";
import { PreviewPanel } from "./panels/previewPanel.js";
import { DiagnosticsService } from "./services/diagnosticsService.js";
import { DocumentStateService } from "./services/documentStateService.js";
import { ThemeResolver } from "./services/themeResolver.js";
import { TransformService } from "./services/transformService.js";
import { WorkspaceTrustService } from "./services/workspaceTrustService.js";
import {
  THEME_MANAGER_VIEW_ID,
  ThemeEditorViewProvider,
} from "./views/themeEditorViewProvider.js";

export function activate(context: vscode.ExtensionContext): void {
  const documentStateService = new DocumentStateService();
  const diagnosticsService = new DiagnosticsService();
  const themeResolver = new ThemeResolver(context.extensionUri.toString());
  const transformService = new TransformService();
  const workspaceTrustService = new WorkspaceTrustService(
    vscode.workspace.isTrusted,
  );
  const previewPanel = new PreviewPanel(documentStateService, transformService);
  const themeEditorViewProvider = new ThemeEditorViewProvider(
    documentStateService,
    diagnosticsService,
    workspaceTrustService,
  );

  registerCommands(context, {
    documentStateService,
    previewPanel,
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
