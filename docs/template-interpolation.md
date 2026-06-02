# Template Interpolation Specification

md-hinagata **Template Interpolation** is the minimal syntax used to insert Markdown-derived values into theme template files. Template files keep the `.hbs` extension for theme compatibility, but md-hinagata does not support full Handlebars syntax.

This specification follows ADR-0005. md-hinagata's goal is not template programming; it is to let a theme control the final HTML structure for each Markdown element.

## Migration Note

Existing custom `.hbs` themes that relied on Handlebars leniency can change output after migrating to Template Interpolation. Unknown variables, path expressions, helpers, partials, conditionals, loops, and non-allowlisted raw insertions are template render errors. They are not rendered as empty strings or ignored. When one of these errors occurs, md-hinagata renders the whole element with the built-in fallback renderer.

## Supported Syntax

### Escaped Insertion

```hbs
{{name}}
{{ name }}
```

If `name` exists in the template context, md-hinagata inserts its scalar value as an HTML-escaped string.

### Raw Insertion

```hbs
{{{name}}}
{{{ name }}}
```

If `name` is an allowlisted raw template value, md-hinagata inserts it as HTML without escaping. In the `0.2.x` line, the only allowlisted raw template value is `inner_html`. Future raw values, such as `highlighted_html`, must be added to the allowlist explicitly.

### Literal Interpolation Delimiter

```hbs
\{{name}}
\{{{name}}}
```

`\{{` emits literal `{{`. `\{{{` emits literal `{{{`. Closing delimiters in ordinary text, `}}` and `}}}`, have no special meaning unless an interpolation token is open.

## Template Value Names

Template value names are limited to this identifier pattern:

```txt
[A-Za-z_][A-Za-z0-9_]*
```

Examples:

```txt
text
inner_html
code
lang
id
level
```

Path expressions such as `foo.bar`, `this`, `../name`, and `name[0]` are not supported.

## Escaping

Escaped insertion applies these HTML escapes:

| Input | Output |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

Raw insertion does not escape output. Raw insertion is limited by the raw template value allowlist.

`raw` remains available as a compatibility value for code block templates, but new templates should prefer `{{code}}`. `{{raw}}` is valid escaped insertion. `{{{raw}}}` is not allowed.

## Parser Rules

The template parser scans left to right.

1. If it sees `\{{{`, it emits literal `{{{` and continues scanning.
2. If it sees `\{{`, it emits literal `{{` and continues scanning.
3. If it sees `{{{`, it reads until the next `}}}` as a raw insertion token.
4. If it sees `{{`, it reads until the next `}}` as an escaped insertion token.
5. Leading and trailing whitespace inside the token is trimmed.
6. If the token value name is not an identifier, rendering fails.
7. If the value name does not exist in the template context, rendering fails.
8. If the raw insertion value name is not in the raw template value allowlist, rendering fails.
9. Any other character is emitted as-is.

Handlebars constructs such as `{{#if}}`, `{{#each}}`, helpers, partials, comments, and block closes are not supported. They are not identifiers, so they produce render errors.

## Render Errors and Fallback

If a template contains any invalid token, md-hinagata does not replace only that token with an empty string or escaped text. It renders the whole target element with the built-in fallback renderer.

Render errors are returned as `template-render-error` diagnostics.

Diagnostic messages include only:

- the template key
- a short reason
- the relevant value name or syntax kind

Diagnostic messages must not include the full template text or Markdown body.

Examples:

```txt
Failed to render template 'h2': unknown template value 'titel'.
Failed to render template 'p': raw insertion is not allowed for 'text'.
Failed to render template 'p': unsupported template syntax '#if text'.
```

## Examples

### Heading

```hbs
<h2 id="{{ id }}" class="article-heading">
  {{{ inner_html }}}
</h2>
```

### Code Block

```hbs
<pre class="code-block"><code class="language-{{ lang }}">{{ code }}</code></pre>
```

### Literal Downstream Template Marker

```hbs
<p>Use \{{name}} in downstream templates.</p>
```

Output:

```html
<p>Use {{name}} in downstream templates.</p>
```
