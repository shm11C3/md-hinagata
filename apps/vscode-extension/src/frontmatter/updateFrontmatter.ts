import { parse as parseYaml } from "yaml";

export interface FrontmatterUpdateRequest {
  readonly source: string;
  readonly themeId: string;
}

export type FrontmatterUpdateResult =
  | {
      readonly ok: true;
      readonly source: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

export function updateFrontmatterTheme(
  request: FrontmatterUpdateRequest,
): FrontmatterUpdateResult {
  const newline = request.source.includes("\r\n") ? "\r\n" : "\n";
  const normalizedSource = request.source.replaceAll("\r\n", "\n");
  const frontmatter = readFrontmatter(normalizedSource);
  if (frontmatter.kind === "broken") {
    return {
      ok: false,
      reason: frontmatter.reason,
    };
  }

  if (frontmatter.kind === "missing") {
    return {
      ok: true,
      source: addFrontmatter(normalizedSource, request.themeId).replaceAll(
        "\n",
        newline,
      ),
    };
  }

  const nextFrontmatter = updateFrontmatterLines(
    frontmatter.lines,
    request.themeId,
  );
  if (!nextFrontmatter.ok) {
    return nextFrontmatter;
  }

  return {
    ok: true,
    source: replaceFrontmatter(
      normalizedSource,
      frontmatter,
      nextFrontmatter.source,
    ).replaceAll("\n", newline),
  };
}

interface ExistingFrontmatter {
  readonly closeLine: number;
  readonly kind: "existing";
  readonly lines: readonly string[];
}

type FrontmatterReadResult =
  | ExistingFrontmatter
  | {
      readonly kind: "missing";
    }
  | {
      readonly kind: "broken";
      readonly reason: string;
    };

function readFrontmatter(source: string): FrontmatterReadResult {
  const lines = source.split("\n");
  if (lines[0] !== "---") {
    return { kind: "missing" };
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (/^---\s*$/.test(lines[index] ?? "")) {
      return {
        closeLine: index,
        kind: "existing",
        lines: lines.slice(1, index),
      };
    }
  }

  return {
    kind: "broken",
    reason: "Frontmatter opening delimiter is missing a closing delimiter.",
  };
}

function addFrontmatter(source: string, themeId: string): string {
  const frontmatter = [
    "---",
    "hinagata:",
    `  theme: ${formatYamlString(themeId)}`,
    "---",
  ];
  if (source.length === 0) {
    return frontmatter.join("\n");
  }

  return [...frontmatter, "", source].join("\n");
}

function replaceFrontmatter(
  source: string,
  frontmatter: ExistingFrontmatter,
  nextFrontmatterLines: readonly string[],
): string {
  const lines = source.split("\n");
  return [
    "---",
    ...nextFrontmatterLines,
    "---",
    ...lines.slice(frontmatter.closeLine + 1),
  ].join("\n");
}

function updateFrontmatterLines(
  lines: readonly string[],
  themeId: string,
):
  | {
      readonly ok: true;
      readonly source: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
    } {
  const editable = validateEditableFrontmatter(lines);
  if (editable !== undefined) {
    return {
      ok: false,
      reason: editable,
    };
  }

  const nextLines = [...lines];
  const hinagataIndex = findTopLevelKeyIndex(nextLines, "hinagata");
  if (hinagataIndex === undefined) {
    return {
      ok: true,
      source: appendHinagataBlock(nextLines, themeId),
    };
  }

  const blockEnd = findTopLevelBlockEnd(nextLines, hinagataIndex);
  const childIndent = inferDirectChildIndent(
    nextLines,
    hinagataIndex,
    blockEnd,
  );
  if (
    hasNonMappingDirectChildren(
      nextLines,
      hinagataIndex + 1,
      blockEnd,
      childIndent,
    )
  ) {
    return {
      ok: false,
      reason: "Existing hinagata frontmatter must be a mapping.",
    };
  }

  const themeIndex = findDirectNestedKeyIndex(
    nextLines,
    "theme",
    hinagataIndex + 1,
    blockEnd,
    childIndent,
  );
  if (themeIndex === undefined) {
    nextLines.splice(
      hinagataIndex + 1,
      0,
      `${childIndent}theme: ${formatYamlString(themeId)}`,
    );
    return {
      ok: true,
      source: nextLines,
    };
  }

  const indent = nextLines[themeIndex]?.match(/^(\s*)/)?.[1] ?? "  ";
  nextLines[themeIndex] = `${indent}theme: ${formatYamlString(themeId)}`;
  return {
    ok: true,
    source: nextLines,
  };
}

function validateEditableFrontmatter(
  lines: readonly string[],
): string | undefined {
  let parsed: unknown;
  try {
    parsed = parseYaml(lines.join("\n"));
  } catch {
    return "Frontmatter could not be parsed safely.";
  }

  if (parsed === null) {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return "Frontmatter could not be parsed safely.";
  }

  const hinagata = parsed.hinagata;
  if (hinagata !== undefined && hinagata !== null && !isRecord(hinagata)) {
    return "Existing hinagata frontmatter must be a mapping.";
  }

  return undefined;
}

function appendHinagataBlock(
  lines: readonly string[],
  themeId: string,
): readonly string[] {
  const nextLines = [...lines];
  if (nextLines.length > 0 && (nextLines.at(-1)?.trim().length ?? 0) > 0) {
    nextLines.push("");
  }

  nextLines.push("hinagata:", `  theme: ${formatYamlString(themeId)}`);
  return nextLines;
}

function findTopLevelKeyIndex(
  lines: readonly string[],
  key: string,
): number | undefined {
  const index = lines.findIndex(
    (line) => line.match(new RegExp(`^${escapeRegExp(key)}\\s*:`)) !== null,
  );
  return index === -1 ? undefined : index;
}

function findTopLevelBlockEnd(
  lines: readonly string[],
  startIndex: number,
): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (
      line !== undefined &&
      line.trim().length > 0 &&
      !/^\s/.test(line) &&
      !line.trimStart().startsWith("#")
    ) {
      return index;
    }
  }

  return lines.length;
}

function findDirectNestedKeyIndex(
  lines: readonly string[],
  key: string,
  startIndex: number,
  endIndex: number,
  childIndent: string,
): number | undefined {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = lines[index];
    if (
      line !== undefined &&
      line.match(
        new RegExp(`^${escapeRegExp(childIndent)}${escapeRegExp(key)}\\s*:`),
      ) !== null
    ) {
      return index;
    }
  }

  return undefined;
}

function inferDirectChildIndent(
  lines: readonly string[],
  parentIndex: number,
  blockEnd: number,
): string {
  const parentIndent = lines[parentIndex]?.match(/^(\s*)/)?.[1] ?? "";
  for (let index = parentIndex + 1; index < blockEnd; index += 1) {
    const line = lines[index];
    if (
      line === undefined ||
      line.trim().length === 0 ||
      line.trimStart().startsWith("#")
    ) {
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    if (indent.length > parentIndent.length) {
      return indent;
    }
  }

  return `${parentIndent}  `;
}

function hasNonMappingDirectChildren(
  lines: readonly string[],
  startIndex: number,
  endIndex: number,
  childIndent: string,
): boolean {
  for (let index = startIndex; index < endIndex; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim().length === 0) {
      continue;
    }

    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    if (indent !== childIndent) {
      continue;
    }

    const value = line.slice(childIndent.length);
    if (value.trimStart().startsWith("#")) {
      continue;
    }

    if (value.match(/^[A-Za-z0-9_-]+\s*:/) === null) {
      return true;
    }
  }

  return false;
}

function formatYamlString(value: string): string {
  return /^[A-Za-z0-9._-]+$/.test(value) ? value : JSON.stringify(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
