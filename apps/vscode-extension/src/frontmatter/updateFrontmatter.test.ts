import { describe, expect, it } from "vitest";

import { updateFrontmatterTheme } from "./updateFrontmatter.js";

describe("updateFrontmatterTheme", () => {
  it("adds hinagata frontmatter when missing", () => {
    expect(
      updateFrontmatterTheme({
        source: "# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source: "---\nhinagata:\n  theme: basic\n---\n\n# Title\n",
    });
  });

  it("updates an existing hinagata theme while preserving metadata", () => {
    expect(
      updateFrontmatterTheme({
        source:
          "---\ntitle: Article\ntags:\n  - docs\nhinagata:\n  theme: old\n  output: fragment\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source:
        "---\ntitle: Article\ntags:\n  - docs\nhinagata:\n  theme: basic\n  output: fragment\n---\n# Title\n",
    });
  });

  it("adds a theme under an existing hinagata block", () => {
    expect(
      updateFrontmatterTheme({
        source:
          "---\ntitle: Article\nhinagata:\n  output: fragment\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source:
        "---\ntitle: Article\nhinagata:\n  theme: basic\n  output: fragment\n---\n# Title\n",
    });
  });

  it("does not update nested theme keys under hinagata", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\nhinagata:\n  output:\n    theme: nested\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source:
        "---\nhinagata:\n  theme: basic\n  output:\n    theme: nested\n---\n# Title\n",
    });
  });

  it("adds a hinagata block to existing frontmatter", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\ntitle: Article\ntags:\n  - docs\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source:
        "---\ntitle: Article\ntags:\n  - docs\n\nhinagata:\n  theme: basic\n---\n# Title\n",
    });
  });

  it("preserves CRLF line endings", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\r\ntitle: Article\r\n---\r\n# Title\r\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: true,
      source:
        "---\r\ntitle: Article\r\n\r\nhinagata:\r\n  theme: basic\r\n---\r\n# Title\r\n",
    });
  });

  it("rejects frontmatter without a closing delimiter", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\ntitle: Article\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: false,
      reason: "Frontmatter opening delimiter is missing a closing delimiter.",
    });
  });

  it("rejects unsupported hinagata frontmatter shapes", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\nhinagata: [\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: false,
      reason: "Existing hinagata frontmatter must be a mapping.",
    });
  });

  it("rejects clearly broken existing metadata", () => {
    expect(
      updateFrontmatterTheme({
        source: "---\ntitle: [\n---\n# Title\n",
        themeId: "basic",
      }),
    ).toEqual({
      ok: false,
      reason: "Frontmatter could not be parsed safely.",
    });
  });

  it("quotes theme ids that need YAML escaping", () => {
    expect(
      updateFrontmatterTheme({
        source: "# Title",
        themeId: "brand theme",
      }),
    ).toEqual({
      ok: true,
      source: '---\nhinagata:\n  theme: "brand theme"\n---\n\n# Title',
    });
  });
});
