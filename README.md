# md-hinagata

Themeable Markdown to HTML Studio for VS Code.

md-hinagata is a VS Code extension and Rust-powered transformation engine for turning Markdown into theme-controlled HTML. It is designed for people who want to write content in Markdown, choose an output theme from frontmatter, edit the theme templates, preview the result, and copy the generated HTML fragment.

md-hinagata is not just another Markdown previewer. Its core purpose is to control the final HTML structure.

```txt
Markdown + frontmatter + theme templates
  -> Rust transform core
  -> structured HTML fragment
  -> preview / copy / export
```

## Status

md-hinagata is planned as a `0.x.x` project.

The first target is `0.1.0`, a vertical-slice MVP that proves the core experience:

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
  "id": "company-blog",
  "name": "Company Blog",
  "version": "0.1.0",
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

## Planned MVP: v0.1.0

The `0.1.0` MVP is intentionally small.

### Included in 0.1.0

- VS Code extension.
- Standard VS Code Markdown editor.
- Frontmatter-based theme selection with `hinagata.theme`.
- Left sidebar Theme Manager.
- Right-side themed preview Webview.
- Rust transform core compiled to WASM.
- Handlebars-based theme templates.
- Bundled `default` theme.
- Workspace themes under `.md-hinagata/themes/{themeId}`.
- Preview updates when Markdown changes.
- Preview updates when theme files are saved.
- Copy Generated HTML command.
- Basic diagnostics for unknown themes and missing templates.

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

### Not included in 0.1.0

- WYSIWYG editing.
- CMS publishing.
- Full static site generation.
- Tauri app.
- CLI.
- Theme package import/export.
- `.hinagata-theme` packages.
- Table support.
- Image and link template support.
- Advanced syntax highlighting.
- Preview element to template jump.
- Left-sidebar code editor.

## VS Code experience

The intended layout:

```txt
+----------------------+--------------------------+
| Theme Manager        | Themed Preview           |
|                      |                          |
| Current Document     | Generated themed HTML    |
| Theme: company-blog  | rendered in Webview      |
|                      |                          |
| Theme Files          |                          |
| - theme.json         |                          |
| - styles.css         |                          |
|                      |                          |
| Templates            |                          |
| - h1.hbs             |                          |
| - h2.hbs             |                          |
| - p.hbs              |                          |
+----------------------+--------------------------+
| VS Code Markdown editor remains the source editor |
+---------------------------------------------------+
```

The left sidebar is a Theme Manager and Inspector. Template files are opened in the normal VS Code editor, so editing, diff, search, formatting, and Git workflow stay native to VS Code.

## Theme resolution

For `0.1.0`, theme resolution is planned as:

```txt
1. workspace/.md-hinagata/themes/{themeId}
2. bundled themes/{themeId}
```

Future versions may add user-level theme paths and importable theme packages.

## Repository structure

Planned structure for the MVP:

```txt
md-hinagata/
  package.json
  pnpm-workspace.yaml
  Cargo.toml
  README.md
  README.ja.md

  apps/
    vscode-extension/
      package.json
      tsconfig.json
      esbuild.config.ts
      src/
        extension.ts
        commands/
          openPreviewCommand.ts
          copyGeneratedHtmlCommand.ts
          selectThemeCommand.ts
        panels/
          previewPanel.ts
        views/
          themeEditorViewProvider.ts
        services/
          transformService.ts
          themeResolver.ts
          documentStateService.ts
        frontmatter/
          updateFrontmatter.ts
        utils/
          webviewHtml.ts
          debounce.ts
      media/
        preview/
        theme-editor/
      resources/
        md-hinagata.svg

  crates/
    md-hinagata-core/
      Cargo.toml
      src/
        lib.rs
        transform.rs
        frontmatter.rs
        theme.rs
        template.rs
        renderer.rs
        diagnostics.rs

    md-hinagata-wasm/
      Cargo.toml
      src/
        lib.rs

  themes/
    default/
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

  examples/
    basic/
      article.md
      expected.html

  schemas/
    theme.schema.json
    frontmatter.schema.json
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

### Extension Development Host

Open the repository root in VS Code, then press F5 or choose `Run md-hinagata Extension` from Run and Debug.

The launch configuration starts an Extension Development Host from `apps/vscode-extension` and runs the `md-hinagata: build extension` task before launch. This builds the extension bundle without packaging a VSIX.

To exercise the Rust/WASM transform path with the bundled example, choose `Run md-hinagata Extension (Basic Example)` from Run and Debug. This opens `examples/basic` as the Extension Development Host workspace, opens `article.md`, and runs the `md-hinagata: prepare basic example` task before launch, so the workspace theme at `.md-hinagata/themes/basic` is available.

In the Extension Development Host:

1. Confirm `article.md` is active when using the basic example launch configuration.
2. Confirm the `md-hinagata` Activity Bar container and Theme Manager view are visible.
3. Run `md-hinagata: Open Preview` from the Command Palette.
4. Compare the generated fragment with `expected.html`.
5. Confirm `md-hinagata: Copy Generated HTML` and `md-hinagata: Select Theme` appear in the Command Palette.

## Rust core

The Rust core is not used because VS Code editing needs Rust. VS Code already handles editing well.

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

Planned defaults:

- Raw HTML is disabled by default.
- Workspace themes are allowed only in trusted workspaces.
- Webview CSP is required.
- Webview local resource roots are restricted.
- Theme package import will validate file paths and file sizes.
- Generated preview HTML will be sanitized or sandboxed.

## Roadmap

### 0.1.x

MVP stabilization.

- Improve preview update reliability.
- Improve diagnostics.
- Improve theme file watching.
- Improve README and examples.

### 0.2.x

Theme authoring improvements.

- Create Theme from Default.
- Duplicate Theme.
- Create Missing Template.
- Template variable inspector.
- Better theme validation.
- JSON Schema integration.

### 0.3.x

Tooling and export.

- CLI.
- CI validation.
- Batch export.
- Open Generated HTML.
- Full HTML export.

### Later

- Theme package import/export.
- `.hinagata-theme` package format.
- Syntax highlighting.
- Link, image, table support.
- Preview element to template jump.
- Tauri standalone app.

## License

md-hinagata uses separate license treatment for source code, themes, examples, user-authored content, and generated output.

- Code: `MIT OR Apache-2.0`.
- Bundled themes: `MIT OR Apache-2.0`.
- User themes: author-defined.
- Examples: `MIT OR Apache-2.0` for now. `CC0-1.0` may be considered later.
- Generated HTML: the tool license does not claim ownership of generated output.
