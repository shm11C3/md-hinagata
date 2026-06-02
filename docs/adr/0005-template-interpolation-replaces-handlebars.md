# Template Interpolation Replaces Handlebars

Accepted: md-hinagata templates keep the `.hbs` file extension for existing theme compatibility, but the supported template surface is **Template Interpolation**, not full Handlebars. The Rust core will use a minimal renderer for `{{name}}` escaped insertion and allowlisted `{{{name}}}` raw insertion; unsupported Handlebars constructs, unknown variables, and non-allowlisted raw insertions produce `template-render-error` diagnostics and fall back to built-in element rendering.

## Considered Options

- Keep `handlebars` as the renderer. Rejected because md-hinagata only needs simple interpolation today, while `handlebars` pulls in parser and derive dependencies that materially affect the WASM bundle.
- Switch to a smaller general-purpose template engine. Rejected because loops, conditionals, helpers, and partials are outside the product contract; a general engine would preserve expressiveness the product does not intend to promise.
- Rename template files away from `.hbs`. Rejected for now because existing themes and user expectations around `templates/*.hbs` should remain stable while the supported syntax surface is clarified.

## Consequences

- Theme authors should treat `.hbs` as a compatibility file extension, not a promise of full Handlebars syntax.
- `{{name}}` inserts escaped text for a known template value.
- `{{{name}}}` inserts already-shaped HTML only for named raw template values such as `inner_html`; future values like `highlighted_html` must be added explicitly.
- The code block value `raw` remains available for compatibility as escaped insertion with `{{raw}}`, but new examples should prefer `{{code}}`; `{{{raw}}}` is not an allowlisted raw insertion.
- `\{{` and `\{{{` output literal `{{` and `{{{` rather than starting interpolation; closing delimiters in ordinary text have no special meaning unless an interpolation is open.
- Whitespace inside interpolation delimiters is accepted, so `{{ name }}` and `{{{ inner_html }}}` are equivalent to `{{name}}` and `{{{inner_html}}}`.
- Template value names are limited to simple identifiers: `[A-Za-z_][A-Za-z0-9_]*`.
- Unknown values, unsupported constructs such as `{{#if}}`, `{{#each}}`, helpers, partials, and non-allowlisted raw values fail the element render path with `template-render-error` and use the same built-in fallback policy as other template render errors.
- If any interpolation token in a template is invalid, the whole element render falls back; md-hinagata does not partially render a template with missing or rewritten tokens.
- Template render diagnostics include the template key, a short reason, and the relevant value name or syntax kind. They must not include the full template source or Markdown content.
