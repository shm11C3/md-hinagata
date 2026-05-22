# Changelog

All notable changes to the md-hinagata VS Code extension are documented in this file.

## 0.1.1

### Fixed

- Allow generated preview HTML to use theme-provided inline styles so the Preview can render themed CSS from generated fragments.

### Documentation

- Add a Marketplace-focused README for the VS Code extension package.

### Maintenance

- Publish the VS Code extension with `vsce --no-dependencies` so the bundled pnpm workspace package can be released without npm dependency detection failures.
- Remove pnpm cache setup before Corepack setup in the publish workflow.
- Add explicit read-only repository permissions to the VS Code extension E2E workflow.

## 0.1.0

### Added

- Add the initial md-hinagata VS Code extension pre-release.
- Add themed preview for Markdown documents.
- Add generated HTML copy support.
- Add document-level theme selection through `hinagata.theme` frontmatter.
- Add bundled and workspace theme resolution for theme-controlled HTML fragments.
