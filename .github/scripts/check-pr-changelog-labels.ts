import {
  type ChangelogPullRequest,
  classifyChangelogPullRequest,
} from "./changelog-core.ts";
import {
  createGitHubClientFromEnv,
  type GitHubClient,
  readRequiredEnv,
} from "./github-api.ts";

interface IssueResponse {
  body?: string | null;
  html_url: string;
  labels: Array<string | { name?: string }>;
  number: number;
  title: string;
}

async function main(): Promise<void> {
  const pullRequestNumber = Number.parseInt(readRequiredEnv("PR_NUMBER"), 10);
  if (!Number.isInteger(pullRequestNumber)) {
    throw new Error("PR_NUMBER must be an integer.");
  }

  const client = createGitHubClientFromEnv();
  const pullRequest = await fetchPullRequestIssue(client, pullRequestNumber);
  const classification = classifyChangelogPullRequest(pullRequest);

  if (classification.kind === "skipped") {
    console.log(`PR #${pullRequest.number} is explicitly skipped.`);
    return;
  }

  console.log(
    `PR #${pullRequest.number} will appear under ${classification.category}.`,
  );
}

async function fetchPullRequestIssue(
  client: GitHubClient,
  pullRequestNumber: number,
): Promise<ChangelogPullRequest> {
  const issue = await client.request<IssueResponse>(
    "GET",
    client.repoPath(`/issues/${pullRequestNumber}`),
  );
  if (issue === undefined) {
    throw new Error(`Pull request #${pullRequestNumber} was not found.`);
  }

  return {
    body: issue.body,
    labels: issue.labels.map(readLabelName).filter(isPresent),
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
