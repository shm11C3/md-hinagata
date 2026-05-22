import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANGELOG_SKIP_LABEL,
  type ChangelogPullRequest,
  ChangelogValidationError,
  classifyChangelogPullRequest,
  extractChangelogOverride,
  formatPullRequestTitle,
  renderChangelogEntry,
  selectPreviousVersionTag,
  updateChangelogEntry,
} from "./changelog-core.ts";

test("classifies a single category label", () => {
  const classification = classifyChangelogPullRequest(
    createPullRequest({ labels: ["type:bug"] }),
  );

  assert.deepEqual(classification, {
    category: "Fixed",
    itemText: "Fix preview CSS.",
    kind: "included",
  });
});

test("allows release preparation PRs to skip with area:release", () => {
  const classification = classifyChangelogPullRequest(
    createPullRequest({ labels: ["area:release", CHANGELOG_SKIP_LABEL] }),
  );

  assert.deepEqual(classification, { kind: "skipped" });
});

test("rejects missing category and skip labels", () => {
  assert.throws(
    () => classifyChangelogPullRequest(createPullRequest({ labels: [] })),
    ChangelogValidationError,
  );
});

test("rejects multiple category labels", () => {
  assert.throws(
    () =>
      classifyChangelogPullRequest(
        createPullRequest({ labels: ["type:bug", "type:feature"] }),
      ),
    /multiple changelog category labels/,
  );
});

test("rejects skip with a non-release category label", () => {
  assert.throws(
    () =>
      classifyChangelogPullRequest(
        createPullRequest({ labels: ["type:bug", CHANGELOG_SKIP_LABEL] }),
      ),
    /changelog:skip and changelog category/,
  );
});

test("uses a one-line Changelog override", () => {
  assert.equal(
    extractChangelogOverride(
      "Summary\n\nChangelog: Render theme CSS in Preview\n",
      42,
    ),
    "Render theme CSS in Preview.",
  );
});

test("rejects linked Changelog overrides", () => {
  assert.throws(
    () => extractChangelogOverride("Changelog: See https://example.com", 42),
    /must not include links/,
  );
});

test("rejects bare Changelog override lines", () => {
  assert.throws(
    () => extractChangelogOverride("Changelog:", 42),
    /empty Changelog: override/,
  );
});

test("formats conventional PR titles", () => {
  assert.equal(
    formatPullRequestTitle("fix(webview): allow inline styles in preview"),
    "Allow inline styles in preview.",
  );
});

test("renders entries by category and merge order", () => {
  const entry = renderChangelogEntry("0.1.2", [
    createPullRequest({
      labels: ["type:bug"],
      mergedAt: "2026-01-02T00:00:00Z",
      number: 2,
      title: "fix: later fix",
      url: "https://example.com/2",
    }),
    createPullRequest({
      labels: ["type:feature"],
      mergedAt: "2026-01-01T00:00:00Z",
      number: 1,
      title: "feat: first feature",
      url: "https://example.com/1",
    }),
  ]);

  assert.equal(
    entry,
    [
      "## 0.1.2",
      "",
      "### Added",
      "",
      "- First feature. ([#1](https://example.com/1))",
      "",
      "### Fixed",
      "",
      "- Later fix. ([#2](https://example.com/2))",
    ].join("\n"),
  );
});

test("replaces only the matching version entry", () => {
  const changelog = [
    "# Changelog",
    "",
    "Intro.",
    "",
    "## 0.1.1",
    "",
    "Old text.",
    "",
    "## 0.1.0",
    "",
    "Initial.",
    "",
  ].join("\n");

  const updated = updateChangelogEntry(
    changelog,
    "0.1.1",
    "## 0.1.1\n\n### Fixed\n\n- New text.",
  );

  assert.equal(
    updated,
    [
      "# Changelog",
      "",
      "Intro.",
      "",
      "## 0.1.1",
      "",
      "### Fixed",
      "",
      "- New text.",
      "",
      "## 0.1.0",
      "",
      "Initial.",
      "",
    ].join("\n"),
  );
});

test("inserts a new version entry before previous entries", () => {
  const updated = updateChangelogEntry(
    "# Changelog\n\nIntro.\n\n## 0.1.1\n\nExisting.\n",
    "0.1.2",
    "## 0.1.2\n\n### Fixed\n\n- New text.",
  );

  assert.equal(
    updated,
    [
      "# Changelog",
      "",
      "Intro.",
      "",
      "## 0.1.2",
      "",
      "### Fixed",
      "",
      "- New text.",
      "",
      "## 0.1.1",
      "",
      "Existing.",
      "",
    ].join("\n"),
  );
});

test("selects the largest prior version tag", () => {
  assert.equal(
    selectPreviousVersionTag(["v0.1.0", "v0.2.0", "v0.2.3", "v0.3.0"], "0.2.4"),
    "v0.2.3",
  );
});

function createPullRequest(
  overrides: Partial<ChangelogPullRequest> = {},
): ChangelogPullRequest {
  return {
    body: null,
    labels: ["type:bug"],
    mergedAt: "2026-01-01T00:00:00Z",
    number: 1,
    title: "fix: fix preview CSS",
    url: "https://example.com/1",
    ...overrides,
  };
}
