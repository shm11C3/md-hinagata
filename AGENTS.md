# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

md-hinagata is a planned `0.x.x` VS Code extension and Rust-powered transformation engine for converting Markdown into theme-controlled HTML fragments.

The core product idea is:

```txt
Markdown + frontmatter + theme templates
  -> Rust/WASM transform core
  -> structured HTML fragment
  -> preview / copy / export
```

This is not intended to become a general Markdown previewer, CMS, static site generator, or universal document converter. The center of the project is controlled HTML structure:

```txt
Markdown block -> theme template -> controlled HTML fragment
```

## Current Repository State

At the time this file was created, the repository contains planning and design documents only:

- `README.md`
- `README.ja.md`
- `docs/requirements.ja.md`
- `docs/design.ja.md`

Do not assume implementation files, package manifests, build scripts, test runners, CI configuration, or release automation exist until they are present in the repository.

## Source Of Truth

Use these documents as the current project source of truth:

1. `docs/requirements.ja.md`
2. `docs/design.ja.md`
3. `README.ja.md`
4. `README.md`

If these documents conflict, prefer the more detailed requirements/design document and ask the maintainer before making a policy-level decision.

## Required Maintainer Confirmation

The maintainer explicitly requires confirmation for unknowns and policy-level choices.

Ask before deciding or changing any of the following:

- Product scope or MVP scope.
- Repository layout beyond what is already documented.
- Runtime, framework, parser, template engine, package manager, or build tool choices.
- Theme schema, frontmatter schema, template variable names, or diagnostic codes.
- Security defaults, including raw HTML handling, sanitization, CSP, Workspace Trust behavior, and webview permissions.
- Publishing setup, package names, marketplace/release policy, or changes to the established license policy.
- Roadmap timing or whether a future feature should move into `0.1.0`.

When in doubt, document the question and ask the maintainer instead of silently choosing a direction.

## Planned Product Scope

The first target is `0.1.0`, a vertical-slice MVP.

Included in `0.1.0`:

- VS Code extension.
- VS Code standard Markdown editor.
- Frontmatter-based theme selection with `hinagata.theme`.
- Left sidebar Theme Manager.
- Right-side themed preview Webview.
- Rust transform core integrated through WASM.
- Handlebars-based theme templates.
- Bundled `default` theme.
- Workspace themes under `.md-hinagata/themes/{themeId}`.
- Preview updates when Markdown changes.
- Preview updates when theme files are saved.
- Copy Generated HTML command.
- Basic diagnostics for unknown themes, missing templates, invalid frontmatter, invalid theme manifests, and template render errors.

Initial Markdown block support:

```txt
h1
h2
h3
p
codeblock
blockquote
ul
ol
li
```

Not included in `0.1.0`:

- WYSIWYG editing.
- CMS publishing.
- Full static site generation.
- CLI.
- Tauri app.
- Web app.
- Theme package import/export.
- `.hinagata-theme` or `.md-hinagata-theme` packages.
- Table support.
- Image and link template support.
- Advanced syntax highlighting.
- Preview element-to-template jump.
- Full code editor inside the sidebar.
- AI assistant features.

## Planned Architecture

The planned repository layout for the MVP is:

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md
  LICENSE

  apps/
    vscode-extension/
      package.json
      tsconfig.json
      esbuild.config.ts
      src/
        extension.ts
        commands/
        panels/
        views/
        services/
        frontmatter/
        utils/
      media/
        preview/
        theme-editor/
      resources/

  crates/
    md-hinagata-core/
      Cargo.toml
      src/

    md-hinagata-wasm/
      Cargo.toml
      src/

  themes/
    default/
      theme.json
      styles.css
      templates/

  examples/
    basic/

  schemas/

  docs/
```

Treat this as planned structure, not current structure, until the files exist.

## Responsibility Boundaries

Keep the VS Code extension responsible for VS Code integration:

- Extension activation and command registration.
- Theme Manager sidebar.
- Preview Webview panel.
- Markdown document watching.
- Theme file watching.
- Workspace and bundled theme file loading.
- Frontmatter updates.
- Clipboard integration.
- Diagnostics presentation.

Keep the Rust core responsible for pure transformation:

- Frontmatter parsing.
- Markdown parsing.
- Theme manifest and template handling.
- Template rendering.
- HTML fragment generation.
- Diagnostics generation.
- Optional sanitization.

The Rust core must not depend on VS Code APIs, workspace filesystem traversal, Webview handling, or clipboard APIs.

## Naming Conventions

Use the documented names unless the maintainer approves a change:

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

## Theme Model

Workspace themes are planned under:

```txt
.md-hinagata/themes/{themeId}
```

Bundled themes are planned under:

```txt
themes/{themeId}
```

For `0.1.0`, the documented theme lookup order is:

```txt
1. workspace/.md-hinagata/themes/{themeId}
2. bundled themes/{themeId}
```

A theme package is a directory containing:

```txt
theme.json
styles.css
templates/*.hbs
```

Template files use Handlebars syntax and `.hbs` extension.

## Template Safety

Do not casually convert escaped values to triple-brace raw insertion.

The documented direction is:

```txt
{{text}}
  Escaped plain text.

{{code}}
  Escaped code text.

{{raw}}
  Escaped raw source text.

{{{inner_html}}}
  HTML generated from Markdown children.
```

Only a limited set of values should be inserted as HTML. Raw Markdown HTML is planned to be disabled by default.

## Security Requirements

Security is part of the initial design because the project handles Markdown, HTML, CSS, templates, and Webviews.

Preserve these documented defaults unless the maintainer approves a change:

- Raw HTML is off by default.
- Preview Webviews must use CSP.
- Webview scripts must be minimized and nonce-controlled.
- `localResourceRoots` must be restricted.
- Workspace themes are enabled only for trusted workspaces.
- Untrusted workspaces use bundled themes only.
- External scripts are not allowed in `0.1.0` Webviews.

Ask before changing any security boundary or weakening a default.

## Development Commands

No development command set is established until package manifests and scripts are added.

Once implementation files exist:

- Prefer repository-defined scripts over ad hoc commands.
- Use `pnpm` only if `pnpm-workspace.yaml` and relevant scripts exist.
- Use `cargo` commands only after the Rust workspace/crates exist.
- Document any new command in the appropriate README or developer docs.

Do not invent CI, formatting, linting, release, or packaging commands as policy without maintainer confirmation.

## Testing Expectations

The planned test areas are:

- Rust core tests for frontmatter parsing, theme manifest parsing, transforms, fallback behavior, and diagnostics.
- VS Code extension tests for command registration, frontmatter updates, theme resolution, workspace theme resolution, and copy behavior.
- Manual QA for preview refresh, theme file refresh, CSS refresh, theme switching, warnings, and generated HTML copying.

When implementation begins, add focused tests for behavior you change. Keep tests aligned with the documented `0.1.0` acceptance criteria.

## License And Distribution

Use the established license policy:

- Code: `MIT OR Apache-2.0`.
- Bundled themes: `MIT OR Apache-2.0`.
- User themes: author-defined.
- Examples: `MIT OR Apache-2.0` for now. `CC0-1.0` may be considered later.
- Generated HTML: the tool license does not claim ownership of generated output.

Do not change this policy without maintainer confirmation.

Do not add or infer any of the following without maintainer confirmation:

- Final copyright holder text for license files.
- Package publishing metadata.
- VS Code Marketplace publishing setup.
- npm package visibility.
- crate publishing metadata.
- release automation.

## Open Questions

The documents currently identify unresolved decisions. Do not resolve these without asking the maintainer:

- Whether `theme.json` `schemaVersion` should be required.
- Which final theme package extension to use.
- Whether template variable naming is strictly `snake_case` or allows `camelCase`.
- How to design safety warnings around `inner_html`.
- How broadly preview CSS is applied.
- Whether full HTML export belongs in `0.2.0` or later.
- When to add output modes beyond `fragment`.
- Whether syntax highlighting belongs in the Rust core or Preview layer.
- Which Markdown parser to lock in.
- How many Handlebars helpers to allow.
- Where the sanitize boundary for `inner_html` belongs.
- Whether raw HTML is escaped, ignored, or handled another way.
- Exact untrusted workspace fallback behavior for workspace themes.

## Agent Behavior

When making changes:

- Read the relevant requirements/design section first.
- Keep edits scoped to the documented MVP unless asked otherwise.
- Preserve the separation between VS Code extension code and Rust transform core.
- Preserve existing docs unless updating them is part of the requested change.
- Ask before making policy-level decisions.
- Do not treat planned structure as already implemented.
- Do not add unrelated tooling or dependencies.
- Do not change license or distribution metadata without maintainer confirmation.
- Write GitHub issues, pull requests, commit messages, and code comments in English.
