import * as vscode from "vscode";

export interface ThemeSelectionOptions {
  isWorkspaceTrusted: boolean;
}

export class ThemeResolver {
  public constructor(private readonly extensionUri: vscode.Uri) {}

  public getBundledThemeRoot(): vscode.Uri {
    return vscode.Uri.joinPath(this.extensionUri, "themes");
  }

  public canSelectTheme(
    themeId: string,
    options: ThemeSelectionOptions,
  ): boolean {
    return options.isWorkspaceTrusted || themeId === "default";
  }

  public dispose(): void {}
}
