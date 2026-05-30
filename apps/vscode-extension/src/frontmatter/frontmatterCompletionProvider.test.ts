import { beforeEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { resetVscodeMock, vscodeMock } from "../../test/vscode.mock.js";
import { registerFrontmatterCompletionProvider } from "./frontmatterCompletionProvider.js";

function createDocument(source: string, offset: number, line: string) {
  return {
    getText: () => source,
    offsetAt: () => offset,
    lineAt: (_position: unknown) => ({ text: line }),
  };
}

function createToken(isCancellationRequested = false) {
  return { isCancellationRequested };
}

function registerProvider(listSelectableThemes: ReturnType<typeof vi.fn>) {
  registerFrontmatterCompletionProvider({ subscriptions: [] } as never, {
    themeResolver: { listSelectableThemes } as never,
    workspaceTrustService: { isTrusted: true } as never,
  });
  const entry = vscodeMock.state.completionProviders[0];
  expect(entry).toBeDefined();
  return entry.provider as vscode.CompletionItemProvider;
}

describe("frontmatterCompletionProvider", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it("registers a markdown completion provider with ':' and ' ' triggers", () => {
    const context = { subscriptions: [] as unknown[] };
    registerFrontmatterCompletionProvider(context as never, {
      themeResolver: { listSelectableThemes: vi.fn(async () => []) } as never,
      workspaceTrustService: { isTrusted: true } as never,
    });

    const entry = vscodeMock.state.completionProviders[0];
    expect(entry.selector).toEqual({ language: "markdown" });
    expect(entry.triggers).toEqual([":", " "]);
    expect(context.subscriptions).toHaveLength(1);
  });

  it("returns scaffold completions without resolving themes", async () => {
    const listSelectableThemes = vi.fn(async () => []);
    const provider = registerProvider(listSelectableThemes);
    const source = "---\nhinagata:\n  theme: default\n  \n---\n\n# Title\n";
    const offset = source.indexOf("  \n---") + 2;
    const document = createDocument(source, offset, "  ");

    const items = (await provider.provideCompletionItems(
      document as never,
      new vscode.Position(3, 2),
      createToken() as never,
      undefined as never,
    )) as vscode.CompletionItem[];

    expect(items.length).toBeGreaterThan(0);
    expect(items.map((item) => item.label)).toContain("output");
    expect(listSelectableThemes).not.toHaveBeenCalled();
  });

  it("resolves themes for a theme value line and maps value completions", async () => {
    const listSelectableThemes = vi.fn(async () => [
      { id: "basic", source: "workspace" as const },
    ]);
    const provider = registerProvider(listSelectableThemes);
    const source =
      "---\nhinagata:\n  theme: \n  output: fragment\n  cssMode: style-tag\n---\n# Title\n";
    const offset = source.indexOf("theme: ") + "theme: ".length;
    const document = createDocument(source, offset, "  theme: ");

    const items = (await provider.provideCompletionItems(
      document as never,
      new vscode.Position(2, 9),
      createToken() as never,
      undefined as never,
    )) as vscode.CompletionItem[];

    expect(listSelectableThemes).toHaveBeenCalledTimes(1);
    const basic = items.find((item) => item.label === "basic");
    expect(basic).toBeDefined();
    expect(basic?.sortText).toMatch(/^\d{4}$/);
  });

  it("returns no completions when cancelled during theme resolution", async () => {
    const listSelectableThemes = vi.fn(async () => [
      { id: "basic", source: "workspace" as const },
    ]);
    const provider = registerProvider(listSelectableThemes);
    const source =
      "---\nhinagata:\n  theme: \n  output: fragment\n  cssMode: style-tag\n---\n# Title\n";
    const offset = source.indexOf("theme: ") + "theme: ".length;
    const document = createDocument(source, offset, "  theme: ");

    const items = await provider.provideCompletionItems(
      document as never,
      new vscode.Position(2, 9),
      createToken(true) as never,
      undefined as never,
    );

    expect(items).toEqual([]);
  });

  it("does not resolve themes for non-theme lines that yield no completions", async () => {
    const listSelectableThemes = vi.fn(async () => []);
    const provider = registerProvider(listSelectableThemes);
    const source = "# Plain document body\n";
    const document = createDocument(source, 5, "# Plain document body");

    const items = (await provider.provideCompletionItems(
      document as never,
      new vscode.Position(0, 5),
      createToken() as never,
      undefined as never,
    )) as vscode.CompletionItem[];

    expect(listSelectableThemes).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });
});
