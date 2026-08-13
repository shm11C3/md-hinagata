import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

interface JsonSchema {
  readonly $id?: string;
  readonly additionalProperties?: boolean | JsonSchema;
  readonly default?: string;
  readonly enum?: readonly string[];
  readonly minLength?: number;
  readonly properties?: Record<string, JsonSchema>;
  readonly required?: readonly string[];
  readonly type?: string;
}

const schema = JSON.parse(
  readFileSync(
    new URL("../../schemas/frontmatter.schema.json", import.meta.url),
    "utf8",
  ),
) as JsonSchema;

describe("frontmatter schema", () => {
  it("describes md-hinagata keys while preserving unrelated document metadata", () => {
    expect(schema.$id).toBe(
      "https://raw.githubusercontent.com/shm11C3/md-hinagata/main/schemas/frontmatter.schema.json",
    );
    expect(schema.type).toBe("object");
    expect(schema.required).toBeUndefined();
    expect(schema.additionalProperties).toBe(true);

    const hinagata = schema.properties?.hinagata;
    expect(hinagata).toMatchObject({
      additionalProperties: false,
      type: "object",
    });
    expect(hinagata?.required).toBeUndefined();

    expect(hinagata?.properties?.theme).toMatchObject({
      default: "default",
      minLength: 1,
      type: "string",
    });
    expect(hinagata?.properties?.output).toMatchObject({
      default: "fragment",
      enum: ["fragment"],
      type: "string",
    });
    expect(hinagata?.properties?.cssMode).toMatchObject({
      default: "style-tag",
      enum: ["style-tag", "inline", "separate", "none"],
      type: "string",
    });
    expect(hinagata?.properties?.lineBreakMode).toMatchObject({
      default: "markdown",
      enum: ["markdown", "br", "wbr"],
      type: "string",
    });
  });
});
