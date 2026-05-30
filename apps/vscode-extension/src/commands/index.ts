import * as vscode from "vscode";
import {
  type CommandDependencies,
  registerCommandsWithApi,
} from "./commandRegistration.js";

export type { CommandDependencies };

export function registerCommands(
  context: vscode.ExtensionContext,
  dependencies: CommandDependencies,
): void {
  registerCommandsWithApi(vscode, context, dependencies);
}
