import { Buffer } from "node:buffer";

import { CHANGELOG_SKIP_LABEL } from "./changelog-core.ts";
import {
  createGitHubClientFromEnv,
  type GitHubClient,
  readRequiredEnv,
} from "./github-api.ts";

const EXTENSION_PACKAGE_PATH = "apps/vscode-extension/package.json";

interface PullRequestResponse {
  base: {
    sha: string;
  };
  head: {
    sha: string;
  };
  number: number;
  title: string;
}

interface PullRequestFile {
  filename: string;
}

interface ContentsResponse {
  content: string;
  encoding: string;
}

interface PackageManifest {
  version?: unknown;
}

interface LabelDefinition {
  color: string;
  description: string;
  name: string;
}

interface IssueResponse {
  labels: Array<string | { name?: string }>;
}

const MANAGED_LABELS = new Set([
  CHANGELOG_SKIP_LABEL,
  "area:docs",
  "area:extension",
  "area:release",
  "area:rust-core",
  "area:theme",
  "area:wasm",
  "area:webview",
  "type:bug",
  "type:docs",
  "type:feature",
  "type:refactor",
  "type:test",
]);

const LABEL_DEFINITIONS: Record<string, LabelDefinition> = {
  [CHANGELOG_SKIP_LABEL]: {
    color: "ededed",
    description: "Exclude this pull request from the extension changelog",
    name: CHANGELOG_SKIP_LABEL,
  },
};

async function main(): Promise<void> {
  const pullRequestNumber = Number.parseInt(readRequiredEnv("PR_NUMBER"), 10);
  if (!Number.isInteger(pullRequestNumber)) {
    throw new Error("PR_NUMBER must be an integer.");
  }

  const client = createGitHubClientFromEnv();
  const pullRequest = await fetchPullRequest(client, pullRequestNumber);
  const files = await client.paginate<PullRequestFile>(
    client.repoPath(`/pulls/${pullRequestNumber}/files`),
  );
  const labels = await inferLabels(client, pullRequest, files);

  await ensureLabels(client, labels);
  const currentLabels = await fetchCurrentLabels(client, pullRequestNumber);
  const nextLabels = new Set(
    currentLabels.filter((label) => !MANAGED_LABELS.has(label)),
  );
  for (const label of labels) {
    nextLabels.add(label);
  }

  await client.request(
    "PUT",
    client.repoPath(`/issues/${pullRequestNumber}/labels`),
    {
      body: { labels: [...nextLabels].sort() },
    },
  );
  console.log(
    `Updated inferred labels on PR #${pullRequestNumber}: ${labels.size === 0 ? "(none)" : [...labels].sort().join(", ")}`,
  );
}

async function fetchPullRequest(
  client: GitHubClient,
  pullRequestNumber: number,
): Promise<PullRequestResponse> {
  const pullRequest = await client.request<PullRequestResponse>(
    "GET",
    client.repoPath(`/pulls/${pullRequestNumber}`),
  );
  if (pullRequest === undefined) {
    throw new Error(`Pull request #${pullRequestNumber} was not found.`);
  }

  return pullRequest;
}

async function fetchCurrentLabels(
  client: GitHubClient,
  pullRequestNumber: number,
): Promise<string[]> {
  const issue = await client.request<IssueResponse>(
    "GET",
    client.repoPath(`/issues/${pullRequestNumber}`),
  );
  if (issue === undefined) {
    throw new Error(`Pull request #${pullRequestNumber} was not found.`);
  }

  return issue.labels.map(readLabelName).filter(isPresent);
}

async function inferLabels(
  client: GitHubClient,
  pullRequest: PullRequestResponse,
  files: readonly PullRequestFile[],
): Promise<Set<string>> {
  const labels = new Set<string>();
  const filenames = files.map((file) => file.filename);

  for (const filename of filenames) {
    for (const label of inferPathLabels(filename)) {
      labels.add(label);
    }
  }

  if (
    filenames.includes(EXTENSION_PACKAGE_PATH) &&
    (await didExtensionVersionChange(
      client,
      pullRequest.base.sha,
      pullRequest.head.sha,
    ))
  ) {
    labels.add("area:release");
    labels.add(CHANGELOG_SKIP_LABEL);
    return labels;
  }

  if (!labels.has("area:release") && !labels.has("area:security")) {
    const titleLabel = inferTitleTypeLabel(pullRequest.title);
    if (titleLabel !== undefined) {
      labels.add(titleLabel);
    }
  }

  if (
    labels.has("area:docs") &&
    !hasChangelogCategoryTypeLabel(labels) &&
    !labels.has("area:release")
  ) {
    labels.add("type:docs");
  }

  if (isTestOnlyChange(filenames) && !hasChangelogCategoryTypeLabel(labels)) {
    labels.add("type:test");
  }

  return labels;
}

function inferPathLabels(filename: string): string[] {
  const labels: string[] = [];

  if (filename.startsWith("apps/vscode-extension/")) {
    labels.push("area:extension");
  }

  if (
    filename.startsWith("apps/vscode-extension/media/") ||
    filename.startsWith("apps/vscode-extension/src/panels/") ||
    filename.startsWith("apps/vscode-extension/src/views/") ||
    filename === "apps/vscode-extension/src/utils/webviewHtml.ts"
  ) {
    labels.push("area:webview");
  }

  if (filename.startsWith("crates/md-hinagata-core/")) {
    labels.push("area:rust-core");
  }

  if (
    filename.startsWith("crates/md-hinagata-wasm/") ||
    filename === "scripts/build-wasm.mjs" ||
    filename === "scripts/copy-wasm-to-extension.mjs"
  ) {
    labels.push("area:wasm");
  }

  if (filename.startsWith("themes/")) {
    labels.push("area:theme");
  }

  if (
    filename.startsWith("docs/") ||
    filename === "README.md" ||
    filename === "README.ja.md" ||
    filename === "apps/vscode-extension/README.md"
  ) {
    labels.push("area:docs");
  }

  if (
    filename === EXTENSION_PACKAGE_PATH ||
    filename === "apps/vscode-extension/CHANGELOG.md" ||
    filename === "docs/release.ja.md" ||
    filename.startsWith(".github/scripts/") ||
    filename.startsWith(".github/workflows/") ||
    filename.startsWith(".github/actions/")
  ) {
    labels.push("area:release");
  }

  return labels;
}

function inferTitleTypeLabel(title: string): string | undefined {
  const prefix = title.match(/^([a-z]+)(\([^)]+\))?:/i)?.[1].toLowerCase();
  switch (prefix) {
    case "feat":
      return "type:feature";
    case "fix":
      return "type:bug";
    case "docs":
      return "type:docs";
    case "test":
      return "type:test";
    case "refactor":
      return "type:refactor";
    default:
      return undefined;
  }
}

function hasChangelogCategoryTypeLabel(labels: ReadonlySet<string>): boolean {
  return (
    labels.has("type:feature") ||
    labels.has("type:bug") ||
    labels.has("type:docs") ||
    labels.has("type:test") ||
    labels.has("type:refactor")
  );
}

function isTestOnlyChange(filenames: readonly string[]): boolean {
  return (
    filenames.length > 0 &&
    filenames.every(
      (filename) =>
        filename.includes("/test/") ||
        filename.includes(".test.") ||
        (filename.startsWith("crates/") && filename.includes("/tests/")),
    )
  );
}

function readLabelName(label: string | { name?: string }): string | undefined {
  return typeof label === "string" ? label : label.name;
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

async function didExtensionVersionChange(
  client: GitHubClient,
  baseRef: string,
  headRef: string,
): Promise<boolean> {
  const [baseVersion, headVersion] = await Promise.all([
    fetchPackageVersion(client, baseRef),
    fetchPackageVersion(client, headRef),
  ]);

  return baseVersion !== headVersion;
}

async function fetchPackageVersion(
  client: GitHubClient,
  ref: string,
): Promise<string | undefined> {
  const contents = await client.request<ContentsResponse>(
    "GET",
    client.repoPath(
      `/contents/${EXTENSION_PACKAGE_PATH}?ref=${encodeURIComponent(ref)}`,
    ),
    { optional: true },
  );
  if (contents === undefined) {
    return undefined;
  }
  if (contents.encoding !== "base64") {
    throw new Error(
      `${EXTENSION_PACKAGE_PATH} response used unsupported encoding: ${contents.encoding}.`,
    );
  }

  const manifest = JSON.parse(
    Buffer.from(contents.content, "base64").toString("utf8"),
  ) as PackageManifest;
  return typeof manifest.version === "string" ? manifest.version : undefined;
}

async function ensureLabels(
  client: GitHubClient,
  labels: ReadonlySet<string>,
): Promise<void> {
  for (const label of labels) {
    const definition = LABEL_DEFINITIONS[label];
    if (definition === undefined) {
      continue;
    }

    const existingLabel = await client.request<unknown>(
      "GET",
      client.repoPath(`/labels/${encodeURIComponent(label)}`),
      { optional: true },
    );
    if (existingLabel !== undefined) {
      continue;
    }

    await client.request("POST", client.repoPath("/labels"), {
      body: definition,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
