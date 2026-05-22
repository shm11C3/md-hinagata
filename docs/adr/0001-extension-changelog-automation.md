# Automate the Extension Changelog from Release Preparation PRs

Accepted: Extension changelog generation is driven by VS Code extension release preparation pull requests that bump `apps/vscode-extension/package.json`. Pull request labels are the source of truth for changelog categorization, and a repository-owned GitHub API script updates only the latest version entry in `apps/vscode-extension/CHANGELOG.md`.

## Considered Options

- Generate changelog entries from commit messages. Rejected because squash and merge conventions make commit text less reliable than reviewed pull request metadata.
- Require every pull request to edit a changelog fragment. Rejected because this makes ordinary feature and bug-fix PRs carry release bookkeeping.
- Adopt release-please, Changesets, or another release tool. Rejected for now because md-hinagata has extension-specific release rules: the published version lives under `apps/vscode-extension`, odd minor versions are Marketplace pre-releases, and tag versions must match the extension package version.

## Consequences

- A release preparation PR declares release intent by changing `apps/vscode-extension/package.json`.
- The generated changelog range is the largest prior `vX.Y.Z` tag lower than the new version through the release PR base branch.
- The release preparation PR itself is excluded from generated notes with `changelog:skip`.
- PRs must have exactly one changelog category label, or an explicit `changelog:skip`.
- The latest changelog entry is generator-owned. Wording changes belong in a pull request `Changelog: ...` override, while category changes belong in labels.
- The update workflow uses `pull_request_target` only with trusted base-branch scripts and does not run for fork pull requests.
