import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetVscodeMock, vscodeMock } from "../../test/vscode.mock.js";
import { registerCommands } from "./index.js";

function createDependencies() {
  return {
    documentStateService: {
      getState: vi.fn(() => ({ status: "idle" })),
      setActiveDocument: vi.fn(),
    },
    documentTransformService: {
      refreshActiveDocument: vi.fn(async () => undefined),
    },
    previewPanel: { show: vi.fn() },
    themeResolver: {
      canSelectTheme: vi.fn(() => true),
      getBundledThemeRoots: vi.fn(() => []),
      listSelectableThemes: vi.fn(async () => []),
    },
    workspaceTrustService: { isTrusted: true },
  };
}

describe("registerCommands", () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it("registers every md-hinagata command through the real vscode API", () => {
    const context = { subscriptions: [] as unknown[] };

    registerCommands(context as never, createDependencies() as never);

    const registered = [...vscodeMock.state.registeredCommands.keys()];
    expect(registered).toEqual(
      expect.arrayContaining([
        "md-hinagata.openPreview",
        "md-hinagata.copyGeneratedHtml",
        "md-hinagata.selectTheme",
        "md-hinagata.createThemeFromDefault",
      ]),
    );
    expect(context.subscriptions.length).toBeGreaterThanOrEqual(4);
  });
});
