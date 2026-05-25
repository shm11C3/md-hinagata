# Keep Syntax Highlighting Fallbacks in the Transform Core

Accepted: Syntax highlighting is part of the Generated HTML contract, so the canonical highlighting output and fallback behavior belong in the Rust transform core rather than in the VS Code Preview layer. Preview and Copy Generated HTML must continue to consume the same `TransformResponse.html`.

Highlighting remains opt-in. The proposed theme manifest switch is `syntaxHighlight.enabled: true`, and the proposed transform-level override is `syntaxHighlight: "auto" | "off"`, where `auto` enables highlighting only for themes that opt in and `off` disables highlighting even when a theme supports it.

## Considered Options

- Apply syntax highlighting only in the VS Code Preview layer. Rejected because Preview would no longer show the same HTML that Copy Generated HTML returns, and future CLI or CI callers would not share the same output semantics.
- Auto-detect languages when a fenced code block omits a language. Rejected because auto-detection is not deterministic enough for generated HTML.
- Emit warnings by default for unsupported language labels. Rejected because authors may use arbitrary labels for CSS, downstream processors, or future languages.
- Choose a highlighter library in this decision. Rejected for this spike because library choice needs a separate comparison of Rust/WASM support, bundle size, supported languages, class naming, sanitization behavior, and license.

## Consequences

- A code block with no language is not highlighted, does not produce a diagnostic, and renders escaped source code.
- A code block with an unsupported language renders escaped source code by default, preserves the original first info-string token in `lang`, and does not produce a diagnostic. A future strict or validation mode may emit `unsupported-highlight-language` with `source: "renderer"`.
- If highlighting fails, throws, panics, or its output cannot pass the sanitization boundary, the transform continues with escaped source code and emits `syntax-highlight-failed` with `source: "renderer"`. Diagnostics include the language and short reason, but never include code content or raw highlighter output.
- The code block language remains the first whitespace-separated token from the CommonMark info string. Alias normalization and resolved highlighter language variables are deferred.
- The code block template context keeps `lang`, `raw`, and `code` for compatibility. `code` is source code text intended for normal escaped Handlebars insertion with `{{code}}`; it is not pre-escaped HTML. `raw` remains for compatibility but is deprecated for new examples and must not be inserted with triple braces.
- New proposed template variables are `language_class`, `is_highlighted`, and `highlighted_html`.
- `language_class` is a complete safe class token such as `language-ts`, derived from the Markdown language token. It is empty when no safe class token can be produced.
- `is_highlighted` means the highlight pipeline succeeded, even if the result contains only escaped text and no visible token spans.
- `highlighted_html` is sanitized inner HTML for the `<code>` element only. It is empty when `is_highlighted` is false.
- The only intended raw insertion boundary for highlighted code is `{{{highlighted_html}}}`. Fallback templates should use `{{code}}`.
- Sanitized highlighted HTML is limited to escaped text plus allowed highlighter token markup such as `<span class="...">`. Wrappers, inline styles, scripts, event handlers, arbitrary attributes, and links are not allowed.
- The Rust core does not inject highlight CSS. Highlight CSS is owned by the theme.
- Existing templates such as `<pre><code class="language-{{lang}}">{{code}}</code></pre>` remain safe and continue to work when highlighting is disabled or unavailable.
