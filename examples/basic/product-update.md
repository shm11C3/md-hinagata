---
hinagata:
  theme: release-note
  output: fragment
---

# md-hinagata 0.1 preview update

This update focuses on making Markdown-to-HTML output easier to inspect before
teams paste it into a CMS, help center, or internal publishing workflow.

## Highlights

- The preview uses the same generated HTML that the copy command provides.
- Workspace themes can be edited without leaving VS Code.
- Frontmatter completion helps authors select valid `hinagata` values.

## Fixed

1. Theme CSS is included in copied HTML when `cssMode` uses the default
   `style-tag` behavior.
2. Unknown workspace themes now fall back to the default theme with a warning.
3. The preview refreshes after saving active theme files.

### Migration note

> Theme manifests remain draft `0.1` files. Expect schema changes while the
> project is still in the `0.x.x` line.

## Example frontmatter

```yaml
hinagata:
  theme: release-note
  output: fragment
```
