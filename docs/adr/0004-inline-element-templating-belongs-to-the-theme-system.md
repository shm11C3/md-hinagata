# Inline Element Templating Belongs to the Theme System

Accepted: Inline Markdown elements (`a`, `img`, `strong`, `em`, inline `code`) are part of the Generated HTML structure that md-hinagata exists to control, so they are rendered through the **Theme** template system like block elements, rather than being hardcoded in the renderer. Until this is implemented, `render_inline` in the Rust core emits inline HTML directly; that hardcoded output becomes the default fallback once the template path exists, so the link/image href-loss bug fix and the templating feature are a single natural progression rather than two competing implementations.

## Considered Options

- Keep inline elements hardcoded in `render_inline` and only fix the `a`/`img` href/src loss. Rejected because a theme could then never control link or image structure (for example `<a target rel>`, wrapping images in `<figure>`), which contradicts the product's purpose of controlling the final HTML structure.
- Template only `a` and `img`, leave `strong`/`em`/`code` hardcoded. Rejected because the boundary would be arbitrary and the template context contract has to be designed for inline elements regardless, so the marginal cost of covering all five is small.

## Consequences

- The theme schema gains optional template keys `a`, `img`, `strong`, `em`, `code`. Existing themes keep working: a missing inline template falls back to the renderer's default HTML, mirroring how block templates already fall back.
- A template context contract must be defined per inline element (proposed: `a` → `{ href, title, text, inner_html }`, `img` → `{ src, alt, title }`, `strong`/`em`/`code` → `{ text, inner_html }`). This contract is public surface and is the part that is expensive to change later.
- Inline templating must compose recursively — an inline template's `inner_html` may itself contain other templated inline elements (for example a bold link).
- The link/image href/src loss is fixed first as a backwards-compatible bug fix (patch `0.2.2`) that emits correct hardcoded HTML; that same HTML is then routed through the template path as the default fallback in the templating feature (minor `0.3.0`).
- Block-level templating is unchanged; this decision extends the same mechanism to inline nodes rather than introducing a separate one.
