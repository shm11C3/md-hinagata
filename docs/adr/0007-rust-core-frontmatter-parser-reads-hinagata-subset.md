# Rust core frontmatter parser reads the hinagata subset

Rust core reads only the md-hinagata-specific subset of Document Frontmatter: a single block-mapping `hinagata` namespace with supported string scalar keys. This keeps the transform core aligned with the Frontmatter Schema while avoiding a full YAML parser dependency in the WASM bundle; unrelated document metadata remains outside the Rust core parser contract.

The VS Code extension may still parse and update frontmatter as YAML when it needs to preserve existing document metadata safely. Invalid or ambiguous `hinagata` shapes, such as duplicate keys or non-mapping values, are reported as invalid frontmatter instead of being silently merged or overridden.
