---
hinagata:
  theme: editorial
  output: fragment
---

# Designing controlled Markdown output

Markdown is excellent for drafting, but publishing systems often need stricter
HTML than a general preview can provide. md-hinagata treats the theme as the
place where teams encode that structure.

## Why templates matter

A template can turn a simple heading into a design-system heading, a paragraph
into a content block, or a code fence into a styled example. Authors keep writing
plain Markdown while the generated fragment stays predictable.

### Useful constraints

- Keep the Markdown source readable.
- Keep the generated HTML stable.
- Keep styling decisions in the theme.

## A publishing workflow

1. Draft the article in Markdown.
2. Select a theme in `hinagata.theme`.
3. Review the themed preview.
4. Copy the generated HTML fragment into the target system.

> The goal is not to replace a CMS. The goal is to make the handoff into a CMS
> more consistent.

## Template sketch

```hbs
<h2 id="{{id}}" class="article-heading">
  {{{inner_html}}}
</h2>
```
