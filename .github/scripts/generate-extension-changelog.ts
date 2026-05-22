import { Buffer } from "node:buffer";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type ChangelogPullRequest,
  ChangelogValidationError,
  compareVersions,
  parseVersion,
  renderChangelogEntry,
  selectPreviousVersionTag,
  updateChangelogEntry,
} from "./changelog-core.ts";
import {
  createGitHubClientFromEnv,
  type GitHubClient,
  readRequiredEnv,
} from "./github-api.ts";

const EXTENSION_PACKAGE_PATH = "apps/vscode-extension/package.json";
const EXTENSION_CHANGELOG_PATH = "apps/vscode-extension/CHANGELOG.md";

interface PullRequestResponse {
  base: {
    ref: string;
    repo: {
      full_name: string;
    };
    sha: string;
  };
  head: {
    ref: string;
    repo: {
      full_name: string;
    };
    sha: string;
  };
  number: number;
}

interface ContentsResponse {
  content: string;
  encoding: string;
}

interface PackageManifest {
  version?: unknown;
}

interface TagResponse {
  name: string;
}

interface CompareResponse {
  commits: Array<{
    sha: string;
  }>;
}

interface AssociatedPullResponse {
  base?: {
    ref?: string;
  };
  html_url?: string;
  merged_at?: string | null;
  number: number;
  title?: string;
}

interface IssueResponse {
  body?: string | null;
  html_url: string;
  labels: Array<string | { name?: string }>;
  number: number;
  title: string;
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--write") ? "write" : "check";
  const workspacePath = path.resolve(process.env.WORKSPACE_PATH ?? ".");
  const pullRequestNumber = Number.parseInt(readRequiredEnv("PR_NUMBER"), 10);
  if (!Number.isInteger(pullRequestNumber)) {
    throw new Error("PR_NUMBER must be an integer.");
  }

  const client = createGitHubClientFromEnv();
  const pullRequest = await fetchPullRequest(client, pullRequestNumber);

  if (pullRequest.head.repo.full_name !== pullRequest.base.repo.full_name) {
    throw new Error(
      "Extension changelog automation only supports same-repository pull requests.",
    );
  }

  const baseVersion = await fetchPackageVersion(client, pullRequest.base.sha);
  const headVersion = await fetchPackageVersion(client, pullRequest.head.sha);

  if (baseVersion === headVersion) {
    console.log("No VS Code extension version bump detected; skipping.");
    return;
  }

  validateVersionBump(baseVersion, headVersion);
  await assertTagDoesNotExist(client, headVersion);

  const previousTag = await findPreviousVersionTag(client, headVersion);
  const changelogPullRequests = await collectChangelogPullRequests(client, {
    baseRef: pullRequest.base.ref,
    baseSha: pullRequest.base.sha,
    previousTag,
    releasePullRequestNumber: pullRequest.number,
  });
  const entry = renderChangelogEntry(headVersion, changelogPullRequests);
  const changelogPath = path.join(workspacePath, EXTENSION_CHANGELOG_PATH);
  const currentChangelog = await readFile(changelogPath, "utf8");
  const nextChangelog = updateChangelogEntry(
    currentChangelog,
    headVersion,
    entry,
  );

  if (mode === "write") {
    await writeFile(changelogPath, nextChangelog);
    console.log(`Updated ${EXTENSION_CHANGELOG_PATH} for ${headVersion}.`);
    return;
  }

  if (currentChangelog !== nextChangelog) {
    throw new Error(
      `${EXTENSION_CHANGELOG_PATH} is not current for ${headVersion}. Run the changelog update workflow or regenerate it locally.`,
    );
  }

  console.log(`${EXTENSION_CHANGELOG_PATH} is current for ${headVersion}.`);
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

async function fetchPackageVersion(
  client: GitHubClient,
  ref: string,
): Promise<string> {
  const contents = await client.request<ContentsResponse>(
    "GET",
    client.repoPath(
      `/contents/${EXTENSION_PACKAGE_PATH}?ref=${encodeURIComponent(ref)}`,
    ),
  );
  if (contents === undefined) {
    throw new Error(`${EXTENSION_PACKAGE_PATH} was not found at ${ref}.`);
  }
  if (contents.encoding !== "base64") {
    throw new Error(
      `${EXTENSION_PACKAGE_PATH} response used unsupported encoding: ${contents.encoding}.`,
    );
  }

  const manifest = JSON.parse(
    Buffer.from(contents.content, "base64").toString("utf8"),
  ) as PackageManifest;
  if (typeof manifest.version !== "string") {
    throw new Error(`${EXTENSION_PACKAGE_PATH} version must be a string.`);
  }

  return manifest.version;
}

function validateVersionBump(baseVersionText: string, headVersionText: string) {
  const baseVersion = parseVersion(baseVersionText);
  const headVersion = parseVersion(headVersionText);

  if (baseVersion === undefined) {
    throw new ChangelogValidationError(
      `Base extension version must be major.minor.patch: ${baseVersionText}.`,
    );
  }
  if (headVersion === undefined) {
    throw new ChangelogValidationError(
      `New extension version must be major.minor.patch: ${headVersionText}.`,
    );
  }
  if (compareVersions(headVersion, baseVersion) <= 0) {
    throw new ChangelogValidationError(
      `New extension version (${headVersionText}) must be greater than base version (${baseVersionText}).`,
    );
  }
}

async function assertTagDoesNotExist(
  client: GitHubClient,
  version: string,
): Promise<void> {
  const tagName = `v${version}`;
  const existingTag = await client.request<unknown>(
    "GET",
    client.repoPath(`/git/ref/tags/${encodeURIComponent(tagName)}`),
    { optional: true },
  );

  if (existingTag !== undefined) {
    throw new ChangelogValidationError(
      `Tag ${tagName} already exists. Bump to a new extension version.`,
    );
  }
}

async function findPreviousVersionTag(
  client: GitHubClient,
  newVersion: string,
): Promise<string> {
  const tags = await client.paginate<TagResponse>(client.repoPath("/tags"));
  const previousTag = selectPreviousVersionTag(
    tags.map((tag) => tag.name),
    newVersion,
  );

  if (previousTag === undefined) {
    throw new ChangelogValidationError(
      `Could not find a previous vX.Y.Z tag before ${newVersion}.`,
    );
  }

  return previousTag;
}

async function collectChangelogPullRequests(
  client: GitHubClient,
  options: {
    baseRef: string;
    baseSha: string;
    previousTag: string;
    releasePullRequestNumber: number;
  },
): Promise<ChangelogPullRequest[]> {
  const compare = await client.request<CompareResponse>(
    "GET",
    client.repoPath(
      `/compare/${encodeURIComponent(options.previousTag)}...${options.baseSha}`,
    ),
  );
  const commits = compare?.commits ?? [];
  const pullRequestNumbers = new Set<number>();

  for (const commit of commits) {
    const associatedPullRequests =
      await client.paginate<AssociatedPullResponse>(
        client.repoPath(`/commits/${commit.sha}/pulls`),
      );

    for (const pullRequest of associatedPullRequests) {
      if (
        pullRequest.number === options.releasePullRequestNumber ||
        pullRequest.merged_at === null ||
        pullRequest.base?.ref !== options.baseRef
      ) {
        continue;
      }

      pullRequestNumbers.add(pullRequest.number);
    }
  }

  const pullRequests = await Promise.all(
    [...pullRequestNumbers].map((pullRequestNumber) =>
      fetchChangelogPullRequest(client, pullRequestNumber),
    ),
  );

  if (pullRequests.length === 0) {
    throw new ChangelogValidationError(
      `No merged pull requests were found between ${options.previousTag} and ${options.baseSha}.`,
    );
  }

  return pullRequests.sort((left, right) => {
    const leftTime = Date.parse(left.mergedAt ?? "");
    const rightTime = Date.parse(right.mergedAt ?? "");
    return leftTime - rightTime || left.number - right.number;
  });
}

async function fetchChangelogPullRequest(
  client: GitHubClient,
  pullRequestNumber: number,
): Promise<ChangelogPullRequest> {
  const [pullRequest, issue] = await Promise.all([
    client.request<AssociatedPullResponse>(
      "GET",
      client.repoPath(`/pulls/${pullRequestNumber}`),
    ),
    client.request<IssueResponse>(
      "GET",
      client.repoPath(`/issues/${pullRequestNumber}`),
    ),
  ]);

  if (pullRequest === undefined || issue === undefined) {
    throw new Error(`Pull request #${pullRequestNumber} was not found.`);
  }

  return {
    body: issue.body,
    labels: issue.labels.map(readLabelName).filter(isPresent),
    mergedAt: pullRequest.merged_at ?? undefined,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
  };
}

function readLabelName(label: string | { name?: string }): string | undefined {
  return typeof label === "string" ? label : label.name;
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
