# AGENTS.md

Guidance entry point for AI coding agents working in this repository.

Keep this file thin. Read the linked documents before making changes.

## Read First

- Product requirements: `docs/requirements.ja.md`
- Product design and architecture: `docs/design.ja.md`
- Development workflow, branch rules, PR rules, and review handling: `docs/development-workflow.md`
- Testing policy and example verification: `docs/testing.md`
- User-facing overview: `README.md`, `README.ja.md`

If documents conflict, prefer the more detailed requirements/design document and ask the maintainer before making a policy-level decision.

## Project Summary

md-hinagata is a planned `0.x.x` VS Code extension and Rust-powered transformation engine for converting Markdown into theme-controlled HTML fragments.

Core flow:

```txt
Markdown + frontmatter + theme templates
  -> Rust/WASM transform core
  -> structured HTML fragment
  -> preview / copy / export
```

The project is centered on controlled HTML structure, not on becoming a general Markdown previewer, CMS, static site generator, or universal document converter.

## Non-Negotiables

- Ask the maintainer before changing product scope, MVP scope, architecture boundaries, security defaults, schema choices, parser/template engine choices, publishing policy, release policy, or license policy.
- Preserve the responsibility boundary between the VS Code extension and the Rust transform core.
- Preserve documented security defaults unless the maintainer explicitly approves a change.
- Keep changes scoped to the current issue or PR purpose.
- Do not silently mix unrelated fixes into the current branch or PR.
- Write GitHub issues, pull requests, commit messages, and code comments in English.

## Stable Names

Use these names unless the maintainer approves a change:

```txt
Product name: md-hinagata
Repository/package name: md-hinagata
Frontmatter namespace: hinagata
Workspace config directory: .md-hinagata
Rust core crate: md-hinagata-core
Rust WASM crate: md-hinagata-wasm
```

Document-level theme selection uses:

```yaml
hinagata:
  theme: default
  output: fragment
```

## Before Finishing

- Check `git status --short --branch`.
- Verify that changed files match the intended scope.
- Run the relevant repository commands described in `docs/development-workflow.md` and `docs/testing.md`.
- Document any skipped manual QA or skipped checks in the PR.
