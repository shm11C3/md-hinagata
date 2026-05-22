export interface Repository {
  owner: string;
  repo: string;
}

export interface GitHubClientOptions {
  apiUrl?: string;
  repository: Repository;
  token: string;
}

export class GitHubClient {
  readonly #apiUrl: string;
  readonly #repository: Repository;
  readonly #token: string;

  public constructor(options: GitHubClientOptions) {
    this.#apiUrl = options.apiUrl ?? "https://api.github.com";
    this.#repository = options.repository;
    this.#token = options.token;
  }

  public get repository(): Repository {
    return this.#repository;
  }

  public async request<T>(
    method: string,
    path: string,
    options: { body?: unknown; optional?: boolean } = {},
  ): Promise<T | undefined> {
    const response = await fetch(`${this.#apiUrl}${path}`, {
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method,
    });

    if (response.status === 404 && options.optional === true) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(
        `GitHub API ${method} ${path} failed: ${response.status} ${await response.text()}`,
      );
    }

    if (response.status === 204) {
      return undefined;
    }

    return (await response.json()) as T;
  }

  public async paginate<T>(path: string): Promise<T[]> {
    const values: T[] = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const pageValues = await this.request<T[]>(
        "GET",
        `${path}${separator}per_page=100&page=${page}`,
      );

      if (pageValues === undefined || pageValues.length === 0) {
        return values;
      }

      values.push(...pageValues);

      if (pageValues.length < 100) {
        return values;
      }
    }
  }

  public repoPath(path: string): string {
    return `/repos/${this.#repository.owner}/${this.#repository.repo}${path}`;
  }
}

export function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

export function readRepositoryFromEnv(): Repository {
  return parseRepository(readRequiredEnv("GITHUB_REPOSITORY"));
}

export function parseRepository(value: string): Repository {
  const [owner, repo] = value.split("/");
  if (
    owner === undefined ||
    repo === undefined ||
    owner === "" ||
    repo === ""
  ) {
    throw new Error(`Invalid repository: ${value}`);
  }

  return { owner, repo };
}

export function createGitHubClientFromEnv(): GitHubClient {
  return new GitHubClient({
    apiUrl: process.env.GITHUB_API_URL,
    repository: readRepositoryFromEnv(),
    token: readRequiredEnv("GITHUB_TOKEN"),
  });
}
