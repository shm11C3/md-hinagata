import { beforeEach, describe, expect, it } from "vitest";
import * as vscode from "vscode";

import { resetVscodeMock, vscodeMock } from "../test/vscode.mock.js";
import { activate, deactivate } from "./extension.js";

function createContext() {
  return {
    subscriptions: [] as Array<{ dispose?: () => void }>,
    extensionUri: vscode.Uri.file("/extension-root"),
  };
}

describe("extension activation", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it("wires commands, completion, webview view, and event subscriptions", () => {
    const context = createContext();

    activate(context as never);

    const registeredCommands = [...vscodeMock.state.registeredCommands.keys()];
    expect(registeredCommands).toEqual(
      expect.arrayContaining([
        "md-hinagata.openPreview",
        "md-hinagata.copyGeneratedHtml",
        "md-hinagata.selectTheme",
        "md-hinagata.createThemeFromDefault",
      ]),
    );
    expect(vscodeMock.state.completionProviders).toHaveLength(1);
    expect(vscodeMock.state.webviewViewProviders.size).toBe(1);
    expect(context.subscriptions.length).toBeGreaterThan(4);
  });

  it("reacts to active editor changes without throwing", () => {
    const context = createContext();
    activate(context as never);

    expect(() =>
      vscodeMock.fireActiveTextEditorChange(undefined),
    ).not.toThrow();
  });

  it("ignores text document changes for non-markdown documents", () => {
    const context = createContext();
    activate(context as never);

    expect(() =>
      vscodeMock.fireTextDocumentChange({
        document: {
          languageId: "plaintext",
          uri: vscode.Uri.file("/notes.txt"),
          getText: () => "plain",
        },
      }),
    ).not.toThrow();
  });

  it("handles save events for documents that are not the active theme file", () => {
    const context = createContext();
    activate(context as never);

    expect(() =>
      vscodeMock.fireSaveTextDocument({
        languageId: "css",
        uri: vscode.Uri.file("/styles.css"),
        getText: () => "",
      }),
    ).not.toThrow();
  });

  it("deactivate is a no-op", () => {
    expect(deactivate()).toBeUndefined();
  });
});
