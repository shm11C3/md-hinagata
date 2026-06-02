# Template File Format Moves to .hinagata

Accepted: the next minor release will make `.hinagata` the canonical **Template File Format** for md-hinagata templates. `.hbs` remains readable as a compatibility input without runtime deprecation warnings in that minor release, but new bundled themes, generated workspace themes, examples, and documentation should use `.hinagata`.

## Consequences

- The file format is first-class: `.hinagata` means HTML shaped by md-hinagata **Template Interpolation**, not full Handlebars.
- Rust core parser diagnostics should be able to report template-file line and column positions without including the full template source or Markdown body in diagnostic messages.
- The VS Code extension should bundle `.hinagata` language support, including a language contribution, TextMate grammar, and language configuration.
- Syntax highlighting should preserve HTML highlighting and add scopes for escaped insertion, raw insertion, and literal delimiter escapes.
