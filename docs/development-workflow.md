# md-hinagata Development Workflow

> Target: AI coding agents and maintainers  
> Related documents: `AGENTS.md`, `docs/requirements.ja.md`, `docs/design.ja.md`, `docs/testing.md`

This document describes day-to-day development workflow, branch rules, pull request boundaries, and review handling for md-hinagata.

## 1. Core Principles

- Keep branch and PR scope narrow. A PR should have one reviewable purpose.
- Branch from `origin/main` for independent work.
- Continue on an existing branch only when the change belongs to that PR.
- Split unrelated bugs, cleanups, or follow-up work into a separate branch and PR.
- Prefer repository-defined scripts over ad hoc commands.
- Verify the current checkout before relying on files or scripts. Open PR branches may contain setup that is not yet on `main`.
- Do not commit generated artifacts unless the repository intentionally tracks them.

## 2. Branch Naming

Use lowercase, hyphen-separated branch names.

```txt
feat/issue-{number}-{short-slug}
fix/{short-slug}
docs/{short-slug}
chore/{short-slug}
```

Examples:

```txt
feat/issue-46-vscode-dev-host-setup
fix/preview-keeps-active-markdown
docs/update-agent-workflow
chore/update-tooling
```

AI coding agents must use branch names that describe the work itself. Do not
prefix branches with the agent or tool name, such as `codex/`, unless the
maintainer explicitly asks for that convention.

## 3. PR Scope Rules

Group changes in one PR only when they share the same purpose and should be reviewed together.

Good grouping:

- Implementation, focused tests, and documentation for one behavior.
- A debug launch configuration and README instructions for that launch flow.
- A bug fix and regression test for the same bug.

Do not group:

- Debug setup and an unrelated runtime bug fix.
- Tooling changes and product behavior changes.
- Refactors that are not required for the requested implementation.
- Generated build artifacts and source changes, unless the artifact is intentionally tracked.

If an unrelated bug is discovered while working on a PR:

1. Keep the current PR focused.
2. Leave the unrelated fix out of that branch.
3. Create a new branch from `origin/main`.
4. Open a separate PR for the bug fix.
5. Mention merge order only when one PR depends on another.

Avoid stacked PRs unless the maintainer asks for that structure. If a PR is intentionally stacked, state the base branch and dependency clearly in the PR body.

## 4. Commits

Write commit messages in English. Use concise messages with a conventional prefix when it fits:

```txt
feat: add ...
fix: keep ...
docs: update ...
test: cover ...
chore: configure ...
```

Split commits when the maintainer asks for it or when separate commits materially improve review. Do not split tiny tightly-coupled edits just to increase commit count.

## 5. Pull Request Descriptions

Write PR titles and descriptions in English.

Open PRs as ready for review by default. Use draft PRs only when the maintainer
asks for a draft, or when the PR is intentionally incomplete or blocked and that
state is clearly explained in the PR body.

Include:

- Summary of what changed.
- Root cause for bug fixes.
- User or developer impact.
- Verification commands that were run.
- Manual QA results, or a clear note when manual QA was not run.
- Issue closing keywords only when the PR fully resolves that issue.

## 6. Review Handling

When review comments arrive:

- Treat each review comment as input to evaluate, not as an instruction to apply automatically.
- Before making a review fix, check whether the comment is correct, in scope for the PR, and consistent with the requirements, design, testing policy, security defaults, and repository conventions.
- Address actionable comments in the same PR only when they are in scope.
- Reply without code changes when a comment is non-actionable, out of scope, or intentionally not being addressed.
- Split unrelated follow-up work into a new issue or PR instead of expanding the current PR.
- Re-run relevant checks after making review fixes.

## 7. Development Commands

Run commands from the repository root unless a package-specific command is required.

```bash
pnpm run format
pnpm run check
pnpm run lint
pnpm run test
pnpm run build
pnpm run build:release
pnpm run build:wasm
```

Use `pnpm` for TypeScript and workspace-level tasks. Use `cargo` directly for Rust-only investigation or when a root script does not cover the needed check.

Run `pnpm run build:wasm` when the WASM bridge, Rust transform path, preview runtime integration, or example launch path is involved.

Use `pnpm run build:release` for VS Code Marketplace packaging checks. It
minifies the extension bundle and omits source maps; keep `pnpm run build` for
development and E2E builds that benefit from source maps.

## 8. Agent Checklist

Before changing code:

- Check `git status --short --branch`.
- Read the relevant requirement, design, issue, or PR context.
- Decide whether the task belongs to the current branch or needs a new branch.
- Ask the maintainer before deciding policy-level or unresolved choices.

While changing code:

- Keep edits scoped to the current issue or PR purpose.
- Prefer existing modules, tests, and helper APIs over new patterns.
- Add focused tests for behavior changes.
- Preserve the VS Code extension and Rust core responsibility boundary.
- Avoid unrelated tooling, dependency, or metadata changes.

Before opening or updating a PR:

- Run the smallest meaningful verification set first, then broaden when touching shared behavior.
- Inspect `git diff --stat` and changed file names to ensure unrelated changes are not included.
- Confirm the PR body lists checks and manual QA accurately.
