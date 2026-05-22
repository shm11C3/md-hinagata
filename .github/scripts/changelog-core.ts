export const CHANGELOG_SKIP_LABEL = "changelog:skip";

export const CATEGORY_ORDER = [
  "Security",
  "Added",
  "Fixed",
  "Documentation",
  "Maintenance",
] as const;

export type ChangelogCategory = (typeof CATEGORY_ORDER)[number];

export interface ChangelogPullRequest {
  body?: string | null;
  labels: readonly string[];
  mergedAt?: string;
  number: number;
  title: string;
  url: string;
}

export type ChangelogClassification =
  | {
      kind: "included";
      category: ChangelogCategory;
      itemText: string;
    }
  | {
      kind: "skipped";
    };

export class ChangelogValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ChangelogValidationError";
  }
}

const CATEGORY_LABELS = new Map<string, ChangelogCategory>([
  ["area:security", "Security"],
  ["type:feature", "Added"],
  ["type:bug", "Fixed"],
  ["type:docs", "Documentation"],
  ["area:release", "Maintenance"],
  ["type:test", "Maintenance"],
  ["type:refactor", "Maintenance"],
]);

const SKIP_COMPATIBLE_CATEGORY_LABELS = new Set(["area:release"]);

export function classifyChangelogPullRequest(
  pullRequest: ChangelogPullRequest,
): ChangelogClassification {
  const labels = normalizeLabels(pullRequest.labels);
  const hasSkipLabel = labels.includes(CHANGELOG_SKIP_LABEL);
  const categoryLabels = labels.filter((label) => CATEGORY_LABELS.has(label));

  if (hasSkipLabel) {
    const incompatibleLabels = categoryLabels.filter(
      (label) => !SKIP_COMPATIBLE_CATEGORY_LABELS.has(label),
    );
    if (incompatibleLabels.length > 0) {
      throw new ChangelogValidationError(
        `PR #${pullRequest.number} has ${CHANGELOG_SKIP_LABEL} and changelog category label(s): ${incompatibleLabels.join(", ")}.`,
      );
    }

    return { kind: "skipped" };
  }

  if (categoryLabels.length === 0) {
    throw new ChangelogValidationError(
      `PR #${pullRequest.number} needs exactly one changelog category label or ${CHANGELOG_SKIP_LABEL}.`,
    );
  }

  if (categoryLabels.length > 1) {
    throw new ChangelogValidationError(
      `PR #${pullRequest.number} has multiple changelog category labels: ${categoryLabels.join(", ")}.`,
    );
  }

  const category = CATEGORY_LABELS.get(categoryLabels[0]);
  if (category === undefined) {
    throw new ChangelogValidationError(
      `PR #${pullRequest.number} has an unsupported changelog category label: ${categoryLabels[0]}.`,
    );
  }

  return {
    category,
    itemText: createChangelogItemText(pullRequest),
    kind: "included",
  };
}

export function renderChangelogEntry(
  version: string,
  pullRequests: readonly ChangelogPullRequest[],
): string {
  const items = new Map<ChangelogCategory, string[]>(
    CATEGORY_ORDER.map((category) => [category, []]),
  );

  for (const pullRequest of [...pullRequests].sort(comparePullRequests)) {
    const classification = classifyChangelogPullRequest(pullRequest);
    if (classification.kind === "skipped") {
      continue;
    }

    items
      .get(classification.category)
      ?.push(
        `- ${classification.itemText} ([#${pullRequest.number}](${pullRequest.url}))`,
      );
  }

  const sections = CATEGORY_ORDER.flatMap((category) => {
    const categoryItems = items.get(category) ?? [];
    if (categoryItems.length === 0) {
      return [];
    }

    return [`### ${category}`, "", ...categoryItems, ""];
  });

  if (sections.length === 0) {
    throw new ChangelogValidationError(
      `No changelog items were generated for ${version}.`,
    );
  }

  return [`## ${version}`, "", ...sections].join("\n").trimEnd();
}

export function updateChangelogEntry(
  changelog: string,
  version: string,
  entry: string,
): string {
  const normalizedEntry = entry.trimEnd();
  const sectionPattern = /^##\s+(.+)$/gm;
  const sections = [...changelog.matchAll(sectionPattern)];
  const targetSection = sections.find(
    (section) => section[1].trim() === version,
  );

  if (targetSection !== undefined) {
    const targetStart = targetSection.index ?? 0;
    const targetSectionIndex = sections.indexOf(targetSection);
    const nextSection = sections[targetSectionIndex + 1];
    const targetEnd = nextSection?.index ?? changelog.length;

    return (
      `${changelog.slice(0, targetStart).trimEnd()}\n\n${normalizedEntry}\n\n${changelog.slice(targetEnd).trimStart()}`.trimEnd() +
      "\n"
    );
  }

  const firstSection = sections[0];
  if (firstSection === undefined) {
    return `${changelog.trimEnd()}\n\n${normalizedEntry}\n`;
  }

  const insertAt = firstSection.index ?? changelog.length;
  return (
    `${changelog.slice(0, insertAt).trimEnd()}\n\n${normalizedEntry}\n\n${changelog.slice(insertAt).trimStart()}`.trimEnd() +
    "\n"
  );
}

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(version: string): Version | undefined {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (match === null) {
    return undefined;
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

export function compareVersions(left: Version, right: Version): number {
  return (
    left.major - right.major ||
    left.minor - right.minor ||
    left.patch - right.patch
  );
}

export function selectPreviousVersionTag(
  tagNames: readonly string[],
  newVersionText: string,
): string | undefined {
  const newVersion = parseVersion(newVersionText);
  if (newVersion === undefined) {
    throw new ChangelogValidationError(
      `Version must be major.minor.patch: ${newVersionText}.`,
    );
  }

  const candidates = tagNames
    .map((tagName) => ({
      tagName,
      version: parseVersion(tagName.replace(/^v/, "")),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        tagName: string;
        version: Version;
      } =>
        candidate.version !== undefined &&
        compareVersions(candidate.version, newVersion) < 0,
    )
    .sort((left, right) => compareVersions(right.version, left.version));

  return candidates[0]?.tagName;
}

export function extractChangelogOverride(
  body: string | null | undefined,
  pullRequestNumber: number,
): string | undefined {
  const matches =
    body
      ?.split(/\r?\n/)
      .map((line) => line.match(/^Changelog:\s*(.*?)\s*$/))
      .filter((match): match is RegExpMatchArray => match !== null) ?? [];

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length > 1) {
    throw new ChangelogValidationError(
      `PR #${pullRequestNumber} has multiple Changelog: overrides.`,
    );
  }

  const override = matches[0][1].trim();
  if (override.length === 0) {
    throw new ChangelogValidationError(
      `PR #${pullRequestNumber} has an empty Changelog: override.`,
    );
  }

  if (/\]\(|https?:\/\//i.test(override)) {
    throw new ChangelogValidationError(
      `PR #${pullRequestNumber} Changelog: override must not include links.`,
    );
  }

  return ensureSentence(override);
}

export function formatPullRequestTitle(title: string): string {
  const withoutPrefix = title
    .replace(
      /^(feat|fix|docs|test|refactor|chore|ci|build|perf|style)(\([^)]+\))?:\s*/i,
      "",
    )
    .trim();

  if (withoutPrefix.length === 0) {
    return ensureSentence(title.trim());
  }

  return ensureSentence(
    `${withoutPrefix.charAt(0).toUpperCase()}${withoutPrefix.slice(1)}`,
  );
}

function createChangelogItemText(pullRequest: ChangelogPullRequest): string {
  return (
    extractChangelogOverride(pullRequest.body, pullRequest.number) ??
    formatPullRequestTitle(pullRequest.title)
  );
}

function comparePullRequests(
  left: ChangelogPullRequest,
  right: ChangelogPullRequest,
): number {
  const leftTime = Date.parse(left.mergedAt ?? "");
  const rightTime = Date.parse(right.mergedAt ?? "");

  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
    return leftTime - rightTime || left.number - right.number;
  }

  return left.number - right.number;
}

function ensureSentence(value: string): string {
  const trimmed = value.trim();
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function normalizeLabels(labels: readonly string[]): string[] {
  return labels.map((label) => label.trim().toLowerCase()).filter(Boolean);
}
