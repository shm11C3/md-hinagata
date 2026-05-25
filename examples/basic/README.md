# Basic Example

This example is a small workspace for trying md-hinagata with workspace themes.
Open `examples/basic` in VS Code, trust the workspace, open one of the Markdown
files below, and run `md-hinagata: Open Preview`.

## Samples

| Markdown | Theme | Purpose |
|---|---|---|
| [`sample.md`](sample.md) | `basic` | Snapshot fixture for the `0.1.0` generated HTML contract. |
| [`knowledge-base.md`](knowledge-base.md) | `docs-clean` | Internal documentation and runbook content. |
| [`product-update.md`](product-update.md) | `release-note` | Release notes, product updates, and change summaries. |
| [`editorial-article.md`](editorial-article.md) | `editorial` | Long-form article content with a more editorial layout. |

## Fixture Contract

- `expected.html` is the exact HTML copied by `md-hinagata: Copy Generated HTML`.
- Theme CSS from `.md-hinagata/themes/basic/styles.css` is included in the generated HTML as a `<style>` tag.
- Preview renders the same generated HTML that the copy command uses.

Keep `sample.md`, `expected.html`, and `.md-hinagata/themes/basic` aligned when
changing transform behavior. The other samples are illustrative workspaces for
manual preview and theme editing.
