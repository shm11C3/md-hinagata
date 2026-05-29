# md-hinagata

[English](README.md) | [日本語](README.ja.md)

<div align="center">
  <img src="assets/logo/hinagata-logo.svg" alt="md-hinagata logo" width="200" />
</div>

<div align="center">

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Shm11C3.md-hinagata-vscode-extension?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=Shm11C3.md-hinagata-vscode-extension)
[![Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/Shm11C3.md-hinagata-vscode-extension?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=Shm11C3.md-hinagata-vscode-extension)

</div>

Themeable Markdown to HTML Studio for VS Code.

md-hinagata is a VS Code extension and Rust-powered transformation engine for turning Markdown into theme-controlled HTML. It is designed for people who want to write content in Markdown, choose an output theme from frontmatter, edit the theme templates, preview the result, and copy the generated HTML fragment.

https://github.com/user-attachments/assets/1ecaf17f-6629-4ef9-b44e-d71d5adefbf1

md-hinagata is not just another Markdown previewer. Its core purpose is to control the final HTML structure.

```txt
Markdown + frontmatter + theme templates
  -> Rust transform core
  -> structured HTML fragment
  -> preview / copy / export
```

## Status

md-hinagata is in early `0.x.x` development.

The current VS Code extension line is `0.1.x` pre-release. The next release
target is `0.2.0`, the first stable Marketplace release.

The implemented core flow is:

```txt
Write Markdown
  -> select a theme with frontmatter
  -> inspect the theme in the left sidebar
  -> edit templates with VS Code
  -> preview themed HTML
  -> copy generated HTML
```

During `0.x.x`, the theme schema, frontmatter schema, template variables, and Rust API may change.

## Why md-hinagata?

Most Markdown tools focus on one of these goals:

- Render Markdown as a preview.
- Generate a full static site.
- Manage CMS content.
- Convert Markdown to many output formats.

md-hinagata focuses on a narrower problem:

> Convert Markdown blocks into predictable, theme-controlled HTML components.

For example, this Markdown:

```md
## Notice

This action cannot be undone.
```

can become this HTML, depending on the selected theme:

```html
<h2 id="notice" class="article-heading article-heading--level2">
  Notice
</h2>
<p class="article-body">
  This action cannot be undone.
</p>
```

The theme is not only CSS. A theme is a package of templates, styles, metadata, and output rules.

### Generated HTML and CSS modes

`hinagata.output: fragment` produces an HTML fragment. By default, when a
resolved theme provides `entryCss`, the generated HTML includes that CSS in a
`<style>` tag followed by the themed document root and rendered Markdown
content.

The Preview webview renders the same generated HTML that `md-hinagata: Copy Generated HTML` copies. Preview does not apply theme CSS through a separate Preview-only path.

`hinagata.cssMode` controls how theme CSS is represented in the generated HTML.
The frontmatter value is the source of truth:

| Mode | Output |
|---|---|
| `style-tag` | Includes theme CSS in a `<style>` tag before the document root. This is the default. |
| `inline` | Expands supported theme CSS into `style` attributes and omits separate CSS. |
| `separate` | Returns document HTML and keeps CSS separate for callers that need it. |
| `none` | Returns document HTML without theme CSS. |

## Core ideas

### Theme selection belongs to the document

A Markdown file chooses its theme through frontmatter:

```md
---
hinagata:
  theme: default
  output: fragment
---

# Title

Body text.
```

This keeps the output reproducible. The document itself knows how it should be transformed.

The current draft frontmatter JSON Schema is tracked at [`schemas/frontmatter.schema.json`](schemas/frontmatter.schema.json). The VS Code extension offers completions for `hinagata` keys inside leading Markdown frontmatter; `hinagata.theme` values come from the same selectable theme set as `md-hinagata: Select Theme`.

### Themes are template packages

A theme is a directory such as:

```txt
.md-hinagata/
  themes/
    company-blog/
      theme.json
      styles.css
      templates/
        h1.hbs
        h2.hbs
        h3.hbs
        p.hbs
        codeblock.hbs
        blockquote.hbs
        ul.hbs
        ol.hbs
        li.hbs
```

A `theme.json` file describes the theme:

```json
{
  "$schema": "https://raw.githubusercontent.com/shm11C3/md-hinagata/main/schemas/theme.schema.json",
  "schemaVersion": "0.1",
  "id": "company-blog",
  "name": "Company Blog",
  "version": "1.0.0",
  "entryCss": "styles.css",
  "templates": {
    "h1": "templates/h1.hbs",
    "h2": "templates/h2.hbs",
    "h3": "templates/h3.hbs",
    "p": "templates/p.hbs",
    "codeblock": "templates/codeblock.hbs",
    "blockquote": "templates/blockquote.hbs",
    "ul": "templates/ul.hbs",
    "ol": "templates/ol.hbs",
    "li": "templates/li.hbs"
  }
}
```

The current draft theme JSON Schema is tracked at [`schemas/theme.schema.json`](schemas/theme.schema.json).

### Templates use Handlebars

Templates use `.hbs` files. `hbs` means Handlebars.

Example `templates/h2.hbs`:

```hbs
<h2 id="{{id}}" class="article-heading article-heading--level2">
  {{{inner_html}}}
</h2>
```

Example `templates/codeblock.hbs`:

```hbs
<pre class="code-block"><code class="language-{{lang}}">{{raw}}</code></pre>
```

Recommended convention:

```txt
{{text}}
  Escaped plain text.

{{{inner_html}}}
  HTML generated from Markdown children.

{{raw}}
  Escaped raw source text.
```

## Current scope

- VS Code extension.
- Standard VS Code Markdown editor.
- Frontmatter-based theme selection with `hinagata.theme`.
- Left sidebar Theme Manager.
- Right-side themed preview Webview.
- Rust transform core compiled to WASM.
- Handlebars-based theme templates.
- Bundled `default` theme.
- Workspace themes under `.md-hinagata/themes/{themeId}`.
- Create Theme from Default command.
- Preview updates when Markdown changes.
- Preview updates when theme files are saved.
- Copy Generated HTML command.
- Basic diagnostics for unknown themes and missing templates.
- CSS output modes through `hinagata.cssMode`.

Markdown block support:

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

Not included:

- WYSIWYG editing.
- CLI.
- Theme package import/export.
- `.hinagata-theme` packages.
- Table support.
- Image and link template support.
- Advanced syntax highlighting.
- Preview element to template jump.
- Left-sidebar code editor.

## VS Code experience

<img width="3594" height="2078" alt="image" src="https://github.com/user-attachments/assets/bd54a18e-bcd6-4da3-b709-1024555a4ffe" />


The left sidebar is a Theme Manager and Inspector. Template files are opened in the normal VS Code editor, so editing, diff, search, formatting, and Git workflow stay native to VS Code.

## Theme resolution

Theme resolution order:

```txt
1. workspace/.md-hinagata/themes/{themeId}, in trusted workspaces
2. bundled themes/{themeId}
```

In untrusted workspaces, workspace theme loading is disabled while bundled
themes, preview, and copy behavior remain available.

## Repository structure

Top-level structure:

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md

  apps/
    vscode-extension/

  crates/
    md-hinagata-core/
    md-hinagata-wasm/

  themes/
    default/

  examples/
    basic/

  schemas/

  docs/
```

## Development setup

Prerequisites:

- Node.js 22 or 24 with `pnpm` 10.x.
- Rust toolchain with Cargo.
- `wasm-bindgen` CLI `0.2.121` for WASM bridge builds.

Install JavaScript workspace dependencies:

```bash
pnpm install
```

Check the Rust workspace:

```bash
cargo check --workspace
```

Install the WASM bridge CLI when building the Rust bridge for the extension:

```bash
cargo install wasm-bindgen-cli --version 0.2.121 --locked
```

Run the current workspace checks:

```bash
pnpm run check
pnpm run format
pnpm run lint
pnpm run test
```

`pnpm run format` formats both the VS Code extension and Rust workspace. `pnpm run lint` runs Biome for the extension, then verifies Rust formatting and Clippy warnings.

Build the VS Code extension bundle:

```bash
pnpm run build
```

Build the WASM bridge and copy the generated module into the VS Code extension:

```bash
pnpm run build:wasm
```

The generated WASM files are written to `apps/vscode-extension/wasm/` and are not committed.

Run the VS Code Extension Host E2E smoke test:

```bash
pnpm run test:e2e
```

This copies `examples/basic` into a temporary workspace, launches VS Code with
the local extension, verifies the contributed commands, and runs Preview, Copy
Generated HTML, and Create Theme from Default against `sample.md`. On Linux CI
this command runs under `xvfb`.

### Extension Development Host

Open the repository root in VS Code, then press F5 or choose `Run md-hinagata Extension` from Run and Debug.

The launch configuration starts an Extension Development Host from `apps/vscode-extension` and runs the `md-hinagata: build extension` task before launch. This builds the extension bundle without packaging a VSIX.

To exercise the Rust/WASM transform path with the bundled example, choose `Run md-hinagata Extension (Basic Example)` from Run and Debug. This opens `examples/basic` as the Extension Development Host workspace, opens `sample.md`, and runs the `md-hinagata: prepare basic example` task before launch, so the workspace theme at `.md-hinagata/themes/basic` is available.

In the Extension Development Host:

1. Confirm `sample.md` is active when using the basic example launch configuration.
2. Confirm the `md-hinagata` Activity Bar container and Theme Manager view are visible.
3. Run `md-hinagata: Open Preview` from the Command Palette.
4. Compare the generated HTML, including theme CSS, with `expected.html`.
5. Confirm `md-hinagata: Copy Generated HTML` and `md-hinagata: Select Theme` appear in the Command Palette.

## Rust core

The Rust core is not used for editing. VS Code already handles editing well.

Rust is used for the transformation engine:

- Markdown and frontmatter parsing.
- Theme template rendering.
- HTML generation.
- Diagnostics.
- Future CLI and CI integration.
- Future batch export.

The VS Code extension should handle VS Code-specific work. The Rust core should remain editor-independent.

```txt
VS Code extension:
  read files
  manage webviews
  update frontmatter
  resolve workspace paths

Rust core:
  receive Markdown and theme packages
  generate HTML
  return diagnostics
```

## Security model

md-hinagata handles Markdown, HTML, CSS, and templates, so security is part of the design.

Current defaults:

- Raw HTML is disabled by default.
- Workspace themes are allowed only in trusted workspaces.
- Webview CSP is required.
- Webview local resource access is restricted to extension-controlled resources.
- Preview HTML is rendered in a VS Code Webview rather than a general browser page.

## Roadmap

### 0.2.x

Stable release hardening and theme authoring improvements.

- Stabilize CSS output modes.
- Improve theme validation and diagnostics.
- Improve JSON Schema integration.
- Improve workspace theme authoring.
- Improve README, examples, and Marketplace metadata.

### 0.3.x

Tooling and export.

- CLI.
- CI validation.
- Batch export.
- Open Generated HTML.
- Full HTML export.
- Table support.

### Later

- Theme package import/export.
- `.hinagata-theme` package format.
- Syntax highlighting.
- Link, image support.
- Preview element to template jump.
- Desktop app.

## License

md-hinagata is licensed under your choice of either:

- [MIT](./LICENSE-MIT)
- [Apache-2.0](./LICENSE-APACHE)

Unless otherwise noted, code, bundled themes, and examples are licensed under
MIT OR Apache-2.0. User-authored content and generated HTML are not claimed by
the tool license. See [Licensing](./docs/licensing.md) for scope details.
