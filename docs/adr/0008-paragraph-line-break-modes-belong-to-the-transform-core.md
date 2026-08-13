# Paragraph line break modes belong to the transform core

Accepted: document frontmatter may set `hinagata.lineBreakMode` to `markdown`,
`br`, or `wbr`. The default `markdown` mode preserves the existing behavior.
The Rust transform core applies the selected mode to soft line breaks inside
Markdown paragraph AST nodes, and Preview and Copy Generated HTML consume the
same result.

## Decision

- `markdown` keeps a paragraph soft break as an HTML source newline. Explicit
  Markdown hard breaks written with two trailing spaces or a backslash remain
  `<br />`.
- `br` converts paragraph soft breaks to `<br />`. Explicit hard breaks remain
  `<br />`, so paragraph line endings use one stable representation.
- `wbr` converts paragraph soft breaks to `<wbr />` without adding whitespace.
  Explicit hard breaks remain `<br />`.
- Unsupported values produce an `unsupported-line-break-mode` warning and
  fall back to `markdown`.
- Tight list item text, table cells, code blocks, and other non-paragraph
  internal line endings are outside this setting.

## Rejected alternatives

- CSS `white-space: pre-line` was rejected because template formatting can
  introduce text-node newlines immediately inside paragraph tags. Those
  newlines can render as unintended blank lines and can change when an HTML
  formatter rewrites the generated source.
- Rewriting elements selected by a theme class such as `.mh-paragraph` was
  rejected because themes own their class names and HTML structure.
- Using line breaks inserted while formatting Generated HTML was rejected
  because formatting whitespace is not document content.

## Consequences

Line break behavior remains reproducible from the Markdown document and is
independent of CSS, theme class names, HTML formatting, PDF conversion, and
downstream paste targets. Theme paragraph templates must emit
`{{{inner_html}}}` to preserve generated `<br />` or `<wbr />` elements; the
escaped `{{text}}` value remains plain text.
