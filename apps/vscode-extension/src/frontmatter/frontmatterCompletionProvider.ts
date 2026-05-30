import * as vscode from "vscode";

import type { ThemeResolver } from "../services/themeResolver.js";
import type { WorkspaceTrustService } from "../services/workspaceTrustService.js";
import { getFileUriDirectory } from "../utils/uri.js";
import {
  type FrontmatterCompletion,
  getFrontmatterCompletions,
} from "./frontmatterCompletion.js";

export interface FrontmatterCompletionProviderDependencies {
  readonly themeResolver: Pick<ThemeResolver, "listSelectableThemes">;
  readonly workspaceTrustService: WorkspaceTrustService;
}

export function registerFrontmatterCompletionProvider(
  context: vscode.ExtensionContext,
  dependencies: FrontmatterCompletionProviderDependencies,
): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: "markdown" },
      createFrontmatterCompletionItemProvider(dependencies),
      ":",
      " ",
    ),
  );
}

function createFrontmatterCompletionItemProvider(
  dependencies: FrontmatterCompletionProviderDependencies,
): vscode.CompletionItemProvider {
  return {
    async provideCompletionItems(document, position, token) {
      const source = document.getText();
      const offset = document.offsetAt(position);
      let completions = getFrontmatterCompletions({
        offset,
        source,
        themes: [],
      });

      if (
        completions.length === 0 &&
        isThemeValueLine(document.lineAt(position).text)
      ) {
        const themes = await dependencies.themeResolver.listSelectableThemes({
          isWorkspaceTrusted: dependencies.workspaceTrustService.isTrusted,
          documentDirectory: getFileUriDirectory(document.uri?.toString()),
        });
        if (token.isCancellationRequested) {
          return [];
        }

        completions = getFrontmatterCompletions({
          offset,
          source,
          themes,
        });
      }

      return completions.map(toCompletionItem);
    },
  };
}

function isThemeValueLine(line: string): boolean {
  return /^\s+theme\s*:/.test(line);
}

function toCompletionItem(
  completion: FrontmatterCompletion,
  index: number,
): vscode.CompletionItem {
  const item = new vscode.CompletionItem(
    completion.label,
    toCompletionItemKind(completion.kind),
  );
  item.detail = completion.detail;
  item.insertText =
    completion.kind === "snippet"
      ? new vscode.SnippetString(completion.insertText)
      : completion.insertText;
  item.sortText = index.toString().padStart(4, "0");
  return item;
}

function toCompletionItemKind(
  kind: FrontmatterCompletion["kind"],
): vscode.CompletionItemKind {
  switch (kind) {
    case "property":
      return vscode.CompletionItemKind.Property;
    case "snippet":
      return vscode.CompletionItemKind.Snippet;
    case "value":
      return vscode.CompletionItemKind.Value;
  }
}
