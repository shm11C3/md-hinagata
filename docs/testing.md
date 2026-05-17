# md-hinagata Testing Policy

> Target: `0.x.x` development  
> Related documents: `docs/requirements.ja.md`, `docs/design.ja.md`, `docs/tasks.ja.md`

This document defines how tests are placed and added in md-hinagata.

## 1. Principles

- Test against the documented `0.1.0` MVP acceptance criteria.
- Add focused tests for behavior you change.
- Colocate unit tests with the implementation they exercise.
- Keep integration tests, snapshot tests, and fixture-driven tests in dedicated `tests/` or `examples/` locations.
- Keep tests aligned with the responsibility boundary between the VS Code extension and the Rust core.

## 2. Placement Rules

### 2.1 Rust

Rust unit tests belong in the target module using `#[cfg(test)] mod tests`.

```txt
crates/md-hinagata-core/src/
  transform.rs
    -> transform unit tests
  frontmatter.rs
    -> frontmatter unit tests
```

Rust integration tests and snapshot tests belong under the crate-level `tests/` directory.

```txt
crates/md-hinagata-core/tests/
  core_snapshots.rs
```

Snapshot input and expected output fixtures belong under `examples/`.

```txt
examples/basic/article.md
examples/basic/expected.html
examples/basic/.md-hinagata/themes/basic/
```

Treat `examples/basic` as a functional fixture, not only sample content. Keep `article.md`, `expected.html`, and the basic theme files aligned when transform behavior changes.

### 2.2 TypeScript / VS Code Extension

TypeScript unit tests belong near the source area they exercise.

```txt
apps/vscode-extension/src/commands/
  selectThemeCommand.ts
  commands.test.ts

apps/vscode-extension/src/services/
  documentStateService.ts
  services.test.ts
```

Unit tests for package-root files such as `package.json` belong near those files at the package root.

```txt
apps/vscode-extension/package.json
apps/vscode-extension/package.test.ts
```

If future tests need to launch the VS Code host, keep those separate from colocated unit tests and choose a dedicated integration-test location.

## 3. Test Targets

### 3.1 Rust Core

- Frontmatter parsing.
- Theme manifest parsing.
- Markdown transforms.
- Fallback behavior.
- Diagnostics.
- Template render errors.

### 3.2 VS Code Extension

- Command registration.
- Frontmatter updates.
- Theme resolution.
- Workspace theme resolution.
- Copy Generated HTML behavior.
- Webview HTML safety boundaries.
- Preview rendering with generated HTML and theme CSS when preview behavior is involved.

### 3.3 Manual QA

Before the `0.1.0` release, verify:

- Editing Markdown updates the Preview.
- Saving `h2.hbs` updates the Preview.
- Saving `styles.css` updates the Preview.
- Changing `hinagata.theme` in frontmatter switches the theme.
- Unknown themes produce a warning.
- Copy Generated HTML copies the expected HTML.

When a VS Code launch configuration for the basic example is present, use it for preview QA. The example workspace should make `.md-hinagata/themes/basic` available as a workspace theme, and opening the preview for `article.md` should show generated content rather than the placeholder.

## 4. Commands

Run from the repository root:

```bash
pnpm run check
pnpm run lint
pnpm run test
```

To test only the Rust workspace:

```bash
cargo test --workspace
```

To test only the VS Code extension:

```bash
pnpm --filter md-hinagata-vscode-extension run test
```
