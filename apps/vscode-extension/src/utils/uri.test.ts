import { describe, expect, it } from "vitest";

import { type StringifiableUri, toUriString } from "./uri.js";

describe("toUriString", () => {
  it("returns the string form of a URI-like value", () => {
    const uri: StringifiableUri = {
      toString: () => "file:///workspace/sample.md",
    };
    expect(toUriString(uri)).toBe("file:///workspace/sample.md");
  });

  it("delegates to the value's own toString implementation", () => {
    let called = 0;
    const uri: StringifiableUri = {
      toString: () => {
        called += 1;
        return "scheme:custom";
      },
    };

    expect(toUriString(uri)).toBe("scheme:custom");
    expect(called).toBe(1);
  });
});
