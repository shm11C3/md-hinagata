import { describe, expect, it } from "vitest";

import { getFrontmatterCompletions } from "./frontmatterCompletion.js";

describe("getFrontmatterCompletions", () => {
  it("suggests the hinagata snippet only inside Document Frontmatter", () => {
    const markdown = "---\ntitle: Article\n\n---\n\n# Title\n";

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("\n---") - 1,
        source: markdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "hinagata:\n  theme: default\n  output: fragment",
        kind: "snippet",
        label: "hinagata",
      },
    ]);

    expect(
      getFrontmatterCompletions({
        offset: markdown.length,
        source: markdown,
        themes: [],
      }),
    ).toEqual([]);

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("\n---") + 1,
        source: markdown,
        themes: [],
      }),
    ).toEqual([]);
  });

  it("suggests only missing hinagata child keys under the existing block", () => {
    const markdown = "---\nhinagata:\n  theme: default\n  \n---\n\n# Title\n";

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("  \n---") + 2,
        source: markdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "output: fragment",
        kind: "property",
        label: "output",
      },
      {
        insertText: "cssMode: style-tag",
        kind: "property",
        label: "cssMode",
      },
      {
        insertText: "lineBreakMode: markdown",
        kind: "property",
        label: "lineBreakMode",
      },
    ]);
  });

  it("does not treat nested keys as existing hinagata child keys", () => {
    const markdown =
      "---\nhinagata:\n  output:\n    theme: nested\n  \n---\n\n# Title\n";

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("  \n---") + 2,
        source: markdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "theme: default",
        kind: "property",
        label: "theme",
      },
      {
        insertText: "cssMode: style-tag",
        kind: "property",
        label: "cssMode",
      },
      {
        insertText: "lineBreakMode: markdown",
        kind: "property",
        label: "lineBreakMode",
      },
    ]);
  });

  it("suggests selectable theme ids at the hinagata theme value", () => {
    const markdown = "---\nhinagata:\n  theme: \n---\n\n# Title\n";

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("theme: ") + "theme: ".length,
        source: markdown,
        themes: [
          { id: "workspace-default", source: "workspace" },
          { id: "default", source: "bundled" },
        ],
      }),
    ).toEqual([
      {
        detail: "workspace",
        insertText: "workspace-default",
        kind: "value",
        label: "workspace-default",
      },
      {
        detail: "bundled",
        insertText: "default",
        kind: "value",
        label: "default",
      },
    ]);
  });

  it("does not replace an empty theme value completion with missing keys", () => {
    const markdown =
      "---\nhinagata:\n  theme: \n  output: fragment\n---\n\n# Title\n";

    expect(
      getFrontmatterCompletions({
        offset: markdown.indexOf("theme: ") + "theme: ".length,
        source: markdown,
        themes: [],
      }),
    ).toEqual([]);
  });

  it("suggests fixed values for output, cssMode, and lineBreakMode", () => {
    const outputMarkdown = "---\nhinagata:\n  output: \n---\n\n# Title\n";
    expect(
      getFrontmatterCompletions({
        offset: outputMarkdown.indexOf("output: ") + "output: ".length,
        source: outputMarkdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "fragment",
        kind: "value",
        label: "fragment",
      },
    ]);

    const cssModeMarkdown = "---\nhinagata:\n  cssMode: \n---\n\n# Title\n";
    expect(
      getFrontmatterCompletions({
        offset: cssModeMarkdown.indexOf("cssMode: ") + "cssMode: ".length,
        source: cssModeMarkdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "style-tag",
        kind: "value",
        label: "style-tag",
      },
      {
        insertText: "inline",
        kind: "value",
        label: "inline",
      },
      {
        insertText: "separate",
        kind: "value",
        label: "separate",
      },
      {
        insertText: "none",
        kind: "value",
        label: "none",
      },
    ]);

    const lineBreakModeMarkdown =
      "---\nhinagata:\n  lineBreakMode: \n---\n\n# Title\n";
    expect(
      getFrontmatterCompletions({
        offset:
          lineBreakModeMarkdown.indexOf("lineBreakMode: ") +
          "lineBreakMode: ".length,
        source: lineBreakModeMarkdown,
        themes: [],
      }),
    ).toEqual([
      {
        insertText: "markdown",
        kind: "value",
        label: "markdown",
      },
      {
        insertText: "br",
        kind: "value",
        label: "br",
      },
      {
        insertText: "wbr",
        kind: "value",
        label: "wbr",
      },
    ]);
  });
});
