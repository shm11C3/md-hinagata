import { beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentTransformService } from "./documentTransformService.js";

interface Diagnostic {
  source: string;
  message: string;
}

function resolution(
  themeId: string,
  diagnostics: Diagnostic[] = [],
  files: string[] = [],
) {
  return {
    theme: { themePackage: { id: themeId }, files },
    diagnostics,
  };
}

function activeState(markdown: string, uri = "file:///doc.md") {
  return { status: "active", uri, markdown };
}

function createHarness(options: {
  states: unknown[];
  resolutions: Record<string, ReturnType<typeof resolution>>;
  transformResults: unknown[];
}) {
  const getState = vi.fn();
  for (const state of options.states) {
    getState.mockReturnValueOnce(state);
  }
  getState.mockReturnValue(options.states[options.states.length - 1]);

  const applyTransformResult = vi.fn((result, meta) => ({
    status: "active",
    result,
    meta,
  }));

  const documentStateService = {
    getState,
    applyTransformResult,
  };

  const resolveTheme = vi.fn(async (themeId: string) => {
    const value = options.resolutions[themeId];
    return value ?? { theme: undefined, diagnostics: [] };
  });
  const themeResolver = { resolveTheme };

  const transform = vi.fn();
  for (const result of options.transformResults) {
    transform.mockResolvedValueOnce(result);
  }
  const transformService = { transform };

  const workspaceTrustService = { isTrusted: true };

  const service = new DocumentTransformService(
    documentStateService as never,
    themeResolver as never,
    transformService as never,
    workspaceTrustService as never,
  );

  return {
    service,
    getState,
    applyTransformResult,
    resolveTheme,
    transform,
  };
}

describe("DocumentTransformService.refreshActiveDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the current state without transforming when no document is active", async () => {
    const idle = { status: "idle" };
    const harness = createHarness({
      states: [idle],
      resolutions: {},
      transformResults: [],
    });

    const result = await harness.service.refreshActiveDocument();

    expect(result).toBe(idle);
    expect(harness.transform).not.toHaveBeenCalled();
    expect(harness.applyTransformResult).not.toHaveBeenCalled();
  });

  it("resolves the default theme and applies the transform result", async () => {
    const state = activeState("# Title");
    const harness = createHarness({
      states: [state, state, state],
      resolutions: { default: resolution("default", [], ["styles.css"]) },
      transformResults: [
        { resolvedThemeId: "default", frontmatter: {}, html: "<h1></h1>" },
      ],
    });

    const result = await harness.service.refreshActiveDocument();

    expect(harness.resolveTheme).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ isWorkspaceTrusted: true }),
    );
    expect(harness.transform).toHaveBeenCalledTimes(1);
    expect(harness.applyTransformResult).toHaveBeenCalledTimes(1);
    const [, meta] = harness.applyTransformResult.mock.calls[0];
    expect(meta.expectedUri).toBe("file:///doc.md");
    expect(meta.themeFiles).toEqual(["styles.css"]);
    expect(result.status).toBe("active");
  });

  it("re-resolves and re-transforms when frontmatter requests another theme", async () => {
    const state = activeState("# Title");
    const harness = createHarness({
      states: [state, state, state],
      resolutions: {
        default: resolution("default"),
        basic: resolution("basic", [], ["basic.css"]),
      },
      transformResults: [
        { resolvedThemeId: "default", frontmatter: { theme: "basic" } },
        { resolvedThemeId: "basic", frontmatter: { theme: "basic" } },
      ],
    });

    const result = await harness.service.refreshActiveDocument();

    expect(harness.resolveTheme).toHaveBeenCalledWith(
      "basic",
      expect.objectContaining({ isWorkspaceTrusted: true }),
    );
    expect(harness.transform).toHaveBeenCalledTimes(2);
    const [, meta] = harness.applyTransformResult.mock.calls[0];
    expect(meta.themeFiles).toEqual(["basic.css"]);
    expect(result.status).toBe("active");
  });

  it("deduplicates diagnostics across resolved themes", async () => {
    const state = activeState("# Title");
    const shared: Diagnostic = { source: "theme", message: "duplicate" };
    const harness = createHarness({
      states: [state, state, state],
      resolutions: {
        default: resolution("default", [shared]),
        basic: resolution("basic", [shared, { source: "css", message: "x" }]),
      },
      transformResults: [
        { resolvedThemeId: "default", frontmatter: { theme: "basic" } },
        { resolvedThemeId: "basic", frontmatter: { theme: "basic" } },
      ],
    });

    await harness.service.refreshActiveDocument();

    const [, meta] = harness.applyTransformResult.mock.calls[0];
    const diagnostics = meta.diagnostics as Diagnostic[];
    expect(diagnostics).toHaveLength(2);
    expect(
      diagnostics.filter((entry) => entry.message === "duplicate"),
    ).toHaveLength(1);
  });

  it("discards the stale result when a newer refresh supersedes it", async () => {
    const state = activeState("# Title");
    const harness = createHarness({
      states: [state],
      resolutions: { default: resolution("default") },
      transformResults: [],
    });
    // Every resolve/transform settles asynchronously so the two refreshes
    // interleave: the second bumps the refresh sequence before the first
    // reaches its sequence guard.
    harness.resolveTheme.mockResolvedValue(resolution("default"));
    harness.transform.mockResolvedValue({
      resolvedThemeId: "default",
      frontmatter: {},
    });

    const [first, second] = await Promise.all([
      harness.service.refreshActiveDocument(),
      harness.service.refreshActiveDocument(),
    ]);

    // The superseded refresh returns the latest state without re-applying;
    // only the winning refresh applies its transform result.
    expect(harness.applyTransformResult).toHaveBeenCalledTimes(1);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
  });
});
