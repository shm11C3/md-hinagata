# Keep CSS Output Modes in the Transform Core

Accepted: CSS Output Mode is part of the Generated HTML contract, so `none`, `separate`, `style-tag`, and `inline` are applied by the Rust transform core rather than by VS Code copy-only post-processing. Preview and Copy Generated HTML both consume the same Generated HTML so users can inspect the exact output they will copy, and future CLI or CI paths can share the same output semantics.

## Considered Options

- Apply CSS modes in the VS Code extension. Rejected because it would make copied HTML depend on extension-only post-processing and would diverge from future non-VS Code callers.
- Keep `inline` separate from the Generated HTML contract. Rejected because Preview and Copy would no longer necessarily show the same output.

## Consequences

- The VS Code extension reads themes, updates frontmatter, calls the WASM transform core, and copies or previews the returned Generated HTML without Copy-specific CSS rewriting.
- The default CSS Output Mode is `style-tag` to preserve the `0.1.1` Generated HTML behavior.
- Document frontmatter is the source of truth for CSS Output Mode; `0.2.0` does not add VS Code settings or command arguments that temporarily override `hinagata.cssMode`.
- Initial `0.2.0` work keeps `Copy Generated HTML` as the only copy command; one-off copy variants can be reconsidered later without weakening the frontmatter contract.
- `cssMode: inline` requires a Rust-side CSS inlining implementation or a Rust-callable inlining layer.
- `TransformResponse.html` remains the source of truth for Preview, Copy Generated HTML, and future generated-output surfaces.
