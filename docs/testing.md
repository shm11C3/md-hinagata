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
examples/basic/sample.md
examples/basic/expected.html
examples/basic/.md-hinagata/themes/basic/
```

Treat `examples/basic` as a functional fixture, not only sample content. Keep `sample.md`, `expected.html`, and the basic theme files aligned when transform behavior changes.

Upstream conformance fixtures belong under `crates/md-hinagata-core/tests/fixtures/`. See the CommonMark conformance harness in section 3.3.

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
- CommonMark parser conformance for MVP block elements (see 3.3).

### 3.2 VS Code Extension

- Command registration.
- Frontmatter updates.
- Theme resolution.
- Workspace theme resolution.
- Copy Generated HTML behavior, including theme CSS in generated HTML when the resolved theme has CSS.
- Webview HTML safety boundaries.
- Preview rendering the same generated HTML that Copy Generated HTML uses.

### 3.3 CommonMark Conformance

A curated subset of CommonMark 0.31.2 spec examples is checked in at
`crates/md-hinagata-core/tests/fixtures/commonmark/mvp-block-elements.json`
and exercised by `crates/md-hinagata-core/tests/commonmark_conformance.rs`.

Use this harness when:

- Changing the Rust parser path (`markdown.rs`, `transform.rs`, `renderer.rs`).
- Upgrading `comrak`.
- Adjusting fallback HTML behavior for MVP block elements (`h1`-`h3`, `p`, codeblock, blockquote, `ul`, `ol`, `li`).

The harness runs each example through `transform` with no theme so the renderer falls back to parser-level HTML, then normalizes two intentional differences before comparing to the spec:

- md-hinagata strips the trailing newline inside code blocks.
- md-hinagata adds an `id` slug attribute to `h1`-`h3` headings.

Examples that intentionally diverge from the spec (thematic breaks, raw HTML escaping by default) are listed in the `KNOWN_DIFFERENT` constant in `commonmark_conformance.rs` with a searchable reason. Adding to that list is a deliberate decision: prefer fixing the underlying parser behavior when the difference is unintentional.

Refresh the fixture from the upstream CommonMark spec with:

```bash
node scripts/refresh-commonmark-fixture.mjs
```

The script pins the CommonMark version. Bumping it is a separate, deliberate change and may require updating `KNOWN_DIFFERENT` if upstream example numbering shifts.

Use the official CommonMark spec examples for parser-level conformance, the local `examples/basic` fixture for transform-level (theme-rendered) snapshots, and the GitHub Flavored Markdown spec only when GFM coverage is explicitly in scope (out of scope for the `0.1.0` MVP).

### 3.4 Manual QA

Before the `0.1.0` release, verify:

- Editing Markdown updates the Preview.
- Saving `h2.hbs` updates the Preview.
- Saving `styles.css` updates the Preview.
- Changing `hinagata.theme` in frontmatter switches the theme.
- Unknown themes produce a warning.
- Copy Generated HTML copies `examples/basic/expected.html`, including theme CSS.
- Preview renders the same generated HTML as the copy command.

When a VS Code launch configuration for the basic example is present, use it for preview QA. The example workspace should make `.md-hinagata/themes/basic` available as a workspace theme, and opening the preview for `sample.md` should show generated content rather than the placeholder.

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

To run the VS Code Extension Host E2E smoke test:

```bash
pnpm run test:e2e
```

This builds the WASM bridge, builds the extension bundle, copies
`examples/basic` into a temporary workspace, launches VS Code against that
workspace, opens `sample.md`, verifies the contributed commands, and runs the
Preview, Copy HTML, and Create Theme from Default commands without packaging a
VSIX.
