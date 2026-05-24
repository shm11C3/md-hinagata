export interface FrontmatterCompletionTheme {
  readonly id: string;
  readonly source: string;
}

export interface FrontmatterCompletionRequest {
  readonly offset: number;
  readonly source: string;
  readonly themes: readonly FrontmatterCompletionTheme[];
}

export interface FrontmatterCompletion {
  readonly detail?: string;
  readonly insertText: string;
  readonly kind: "property" | "snippet" | "value";
  readonly label: string;
}

const HINAGATA_SNIPPET = "hinagata:\n  theme: default\n  output: fragment";
const HINAGATA_CHILD_KEY_COMPLETIONS: readonly FrontmatterCompletion[] = [
  {
    insertText: "theme: default",
    kind: "property",
    label: "theme",
  },
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
];
const OUTPUT_VALUE_COMPLETIONS: readonly FrontmatterCompletion[] = [
  {
    insertText: "fragment",
    kind: "value",
    label: "fragment",
  },
];
const CSS_MODE_VALUE_COMPLETIONS: readonly FrontmatterCompletion[] = [
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
];

export function getFrontmatterCompletions(
  request: FrontmatterCompletionRequest,
): FrontmatterCompletion[] {
  const frontmatter = findLeadingFrontmatter(request.source);
  if (
    frontmatter === undefined ||
    request.offset < frontmatter.contentStart ||
    request.offset >= frontmatter.contentEnd
  ) {
    return [];
  }

  const line = readLineAtOffset(request.source, request.offset);
  const frontmatterSource = request.source.slice(
    frontmatter.contentStart,
    frontmatter.contentEnd,
  );
  const lines = readLinesWithOffsets(frontmatterSource);
  const lineIndex = findLineIndexAtOffset(
    lines,
    request.offset - frontmatter.contentStart,
  );
  if (readIndent(line).length > 0) {
    return getHinagataChildCompletions(lines, lineIndex, request.themes);
  }

  if (hasTopLevelHinagata(frontmatterSource)) {
    return [];
  }

  return [
    {
      insertText: HINAGATA_SNIPPET,
      kind: "snippet",
      label: "hinagata",
    },
  ];
}

interface SourceLine {
  readonly end: number;
  readonly start: number;
  readonly text: string;
}

interface FrontmatterBounds {
  readonly contentEnd: number;
  readonly contentStart: number;
}

function findLeadingFrontmatter(source: string): FrontmatterBounds | undefined {
  const contentStart = source.startsWith("---\n")
    ? "---\n".length
    : source.startsWith("---\r\n")
      ? "---\r\n".length
      : undefined;
  if (contentStart === undefined) {
    return undefined;
  }

  let lineStart = contentStart;
  while (lineStart <= source.length) {
    const nextLineBreak = source.indexOf("\n", lineStart);
    const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
    if (line.trim() === "---") {
      return {
        contentEnd: lineStart,
        contentStart,
      };
    }

    if (nextLineBreak === -1) {
      break;
    }
    lineStart = nextLineBreak + 1;
  }

  return undefined;
}

function readLineAtOffset(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextLineBreak = source.indexOf("\n", offset);
  const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  return source.slice(lineStart, lineEnd).replace(/\r$/, "");
}

function readIndent(line: string): string {
  return line.match(/^(\s*)/)?.[1] ?? "";
}

function hasTopLevelHinagata(frontmatterSource: string): boolean {
  return frontmatterSource
    .split(/\r?\n/)
    .some((line) => /^hinagata\s*:/.test(line));
}

function readLinesWithOffsets(source: string): readonly SourceLine[] {
  const lines: SourceLine[] = [];
  let lineStart = 0;
  while (lineStart <= source.length) {
    const nextLineBreak = source.indexOf("\n", lineStart);
    const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
    lines.push({
      end: lineEnd,
      start: lineStart,
      text: source.slice(lineStart, lineEnd).replace(/\r$/, ""),
    });

    if (nextLineBreak === -1) {
      break;
    }
    lineStart = nextLineBreak + 1;
  }

  return lines;
}

function findLineIndexAtOffset(
  lines: readonly SourceLine[],
  offset: number,
): number {
  const index = lines.findIndex(
    (line) => offset >= line.start && offset <= line.end,
  );
  return index === -1 ? lines.length - 1 : index;
}

function getHinagataChildCompletions(
  lines: readonly SourceLine[],
  lineIndex: number,
  themes: readonly FrontmatterCompletionTheme[],
): FrontmatterCompletion[] {
  const hinagataIndex = lines.findIndex((line) =>
    /^hinagata\s*:/.test(line.text),
  );
  if (
    hinagataIndex === -1 ||
    lineIndex <= hinagataIndex ||
    !isInsideHinagataBlock(lines, hinagataIndex, lineIndex)
  ) {
    return [];
  }

  const valueCompletions = getHinagataValueCompletions(
    lines[lineIndex]?.text ?? "",
    themes,
  );
  if (valueCompletions.length > 0) {
    return valueCompletions;
  }

  const existingKeys = readHinagataChildKeys(lines, hinagataIndex);
  return HINAGATA_CHILD_KEY_COMPLETIONS.filter(
    (completion) => !existingKeys.has(completion.label),
  );
}

function getHinagataValueCompletions(
  line: string,
  themes: readonly FrontmatterCompletionTheme[],
): FrontmatterCompletion[] {
  const key = line.match(/^\s+(theme|output|cssMode)\s*:/)?.[1];
  if (key === "output") {
    return [...OUTPUT_VALUE_COMPLETIONS];
  }

  if (key === "cssMode") {
    return [...CSS_MODE_VALUE_COMPLETIONS];
  }

  if (key === "theme") {
    return themes.map((theme) => ({
      detail: theme.source,
      insertText: theme.id,
      kind: "value",
      label: theme.id,
    }));
  }

  return [];
}

function isInsideHinagataBlock(
  lines: readonly SourceLine[],
  hinagataIndex: number,
  lineIndex: number,
): boolean {
  for (let index = hinagataIndex + 1; index <= lineIndex; index += 1) {
    const text = lines[index]?.text ?? "";
    if (text.trim().length === 0 || text.trimStart().startsWith("#")) {
      continue;
    }
    if (readIndent(text).length === 0) {
      return false;
    }
  }

  return true;
}

function readHinagataChildKeys(
  lines: readonly SourceLine[],
  hinagataIndex: number,
): Set<string> {
  const keys = new Set<string>();
  const childIndent = readHinagataChildIndent(lines, hinagataIndex);
  for (let index = hinagataIndex + 1; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? "";
    if (
      text.trim().length > 0 &&
      !text.trimStart().startsWith("#") &&
      readIndent(text).length === 0
    ) {
      break;
    }

    const key = text.match(
      new RegExp(`^${escapeRegExp(childIndent)}([A-Za-z][A-Za-z0-9_-]*)\\s*:`),
    )?.[1];
    if (key !== undefined) {
      keys.add(key);
    }
  }

  return keys;
}

function readHinagataChildIndent(
  lines: readonly SourceLine[],
  hinagataIndex: number,
): string {
  for (let index = hinagataIndex + 1; index < lines.length; index += 1) {
    const text = lines[index]?.text ?? "";
    if (text.trim().length === 0 || text.trimStart().startsWith("#")) {
      continue;
    }

    const indent = readIndent(text);
    return indent.length === 0 ? "  " : indent;
  }

  return "  ";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
