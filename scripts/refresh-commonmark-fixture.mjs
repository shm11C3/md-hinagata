// Refresh the curated CommonMark MVP-block fixture from the upstream spec.
//
// Usage:
//   node scripts/refresh-commonmark-fixture.mjs
//
// The fixture lives at
// `crates/md-hinagata-core/tests/fixtures/commonmark/mvp-block-elements.json`
// and is consumed by `commonmark_conformance.rs`. Pin the CommonMark
// version below when refreshing; bumping the version is a deliberate
// change that may require updating the test harness `KNOWN_DIFFERENT`
// allowlist if example numbering shifts.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMONMARK_VERSION = "0.31.2";
const SPEC_URL = `https://raw.githubusercontent.com/commonmark/commonmark-spec/${COMMONMARK_VERSION}/spec.txt`;
const MVP_SECTIONS = [
  "ATX headings",
  "Setext headings",
  "Paragraphs",
  "Fenced code blocks",
  "Indented code blocks",
  "Block quotes",
  "List items",
  "Lists",
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixturePath = path.join(
  repoRoot,
  "crates",
  "md-hinagata-core",
  "tests",
  "fixtures",
  "commonmark",
  "mvp-block-elements.json",
);

const response = await fetch(SPEC_URL);
if (!response.ok) {
  throw new Error(`Failed to fetch ${SPEC_URL}: ${response.status}`);
}
const specText = await response.text();
const examples = extractExamples(specText);
const filtered = examples.filter((example) =>
  MVP_SECTIONS.includes(example.section),
);

const fixture = {
  commonmarkVersion: COMMONMARK_VERSION,
  source: `https://spec.commonmark.org/${COMMONMARK_VERSION}/`,
  specSource: SPEC_URL,
  description:
    "Curated subset of CommonMark 0.31.2 examples covering the documented 0.1.0 MVP block elements (h1-h3, p, codeblock, blockquote, ul, ol, li). Refresh with scripts/refresh-commonmark-fixture.mjs.",
  sections: MVP_SECTIONS,
  examples: filtered,
};

await mkdir(path.dirname(fixturePath), { recursive: true });
await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

console.log(
  `Wrote ${filtered.length} example(s) across ${MVP_SECTIONS.length} section(s) to ${path.relative(repoRoot, fixturePath)}`,
);

function extractExamples(text) {
  const tests = [];
  const lines = text.split("\n");
  const headerRe = /^#{1,6} *(.*)$/;
  const fenceRe = /^(`{32,})\s*example/;
  let example = 0;
  let section = "";
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fenceMatch = line.match(fenceRe);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      example += 1;
      const markdownLines = [];
      i += 1;
      while (i < lines.length && lines[i] !== ".") {
        markdownLines.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error(
          `Malformed CommonMark spec: missing markdown/html separator for example ${example}`,
        );
      }
      i += 1;
      const htmlLines = [];
      while (i < lines.length && !lines[i].startsWith(fence)) {
        htmlLines.push(lines[i]);
        i += 1;
      }
      if (i >= lines.length) {
        throw new Error(
          `Malformed CommonMark spec: missing closing fence for example ${example}`,
        );
      }
      i += 1;
      tests.push({
        example,
        section,
        markdown: markdownLines.join("\n").replaceAll("→", "\t"),
        expectedHtml: htmlLines.join("\n").replaceAll("→", "\t"),
      });
      continue;
    }
    const headerMatch = line.match(headerRe);
    if (headerMatch) {
      section = headerMatch[1];
    }
    i += 1;
  }
  return tests;
}
