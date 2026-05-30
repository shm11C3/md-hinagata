# Changelog

All notable changes to the md-hinagata VS Code extension are documented in this file.

## 0.2.3

### Maintenance

- Shrink wasm bundle with size profile and wasm-opt. ([#143](https://github.com/shm11C3/md-hinagata/pull/143))

## 0.2.2

### Fixed

- Keep markdown commands usable without editor focus. ([#144](https://github.com/shm11C3/md-hinagata/pull/144))

## 0.2.1

### Fixed

- Use default theme for Markdown without hinagata.theme (#111). ([#132](https://github.com/shm11C3/md-hinagata/pull/132))
- Render href/src for inline links and images. ([#140](https://github.com/shm11C3/md-hinagata/pull/140))

### Documentation

- Add VS Code Marketplace badge to READMEs. ([#131](https://github.com/shm11C3/md-hinagata/pull/131))
- Fix Marketplace 404 on extension README example links. ([#133](https://github.com/shm11C3/md-hinagata/pull/133))
- Add ADR 0004 for inline element templating. ([#138](https://github.com/shm11C3/md-hinagata/pull/138))

### Maintenance

- Stop extension changelog failing once on PR open. ([#139](https://github.com/shm11C3/md-hinagata/pull/139))
- Restore pull-requests:write for the changelog label job. ([#141](https://github.com/shm11C3/md-hinagata/pull/141))

## 0.2.0

### Maintenance

- Revert changes to VS Code API typings and engine requirements. ([#129](https://github.com/shm11C3/md-hinagata/pull/129))

## 0.1.5

### Maintenance

- Update display name and description in package.json for clarity. ([#116](https://github.com/shm11C3/md-hinagata/pull/116))
- Lower VS Code engine requirement. ([#117](https://github.com/shm11C3/md-hinagata/pull/117))
- Clarify repository license files and generated output licensing scope. ([#118](https://github.com/shm11C3/md-hinagata/pull/118))
- Keep Marketplace publish validation aligned with the supported VS Code engine. ([#122](https://github.com/shm11C3/md-hinagata/pull/122))
- Align VS Code API typings with engine baseline. ([#125](https://github.com/shm11C3/md-hinagata/pull/125))

## 0.1.4

### Maintenance

- Fix VS Code extension packaging assets. ([#114](https://github.com/shm11C3/md-hinagata/pull/114))

## 0.1.3

### Documentation

- Record syntax highlighting fallback decision. ([#108](https://github.com/shm11C3/md-hinagata/pull/108))
- Add example workspace samples. ([#109](https://github.com/shm11C3/md-hinagata/pull/109))
- Refresh README content for 0.2.0 preparation. ([#110](https://github.com/shm11C3/md-hinagata/pull/110))
- Update README to remove old VS Code layout details. ([#112](https://github.com/shm11C3/md-hinagata/pull/112))

### Maintenance

- Fix VS Code extension license packaging. ([#99](https://github.com/shm11C3/md-hinagata/pull/99))
- Update edition to 2024 in Cargo.toml. ([#96](https://github.com/shm11C3/md-hinagata/pull/96))
- Add frontmatter completion. ([#100](https://github.com/shm11C3/md-hinagata/pull/100))
- Add release extension build. ([#102](https://github.com/shm11C3/md-hinagata/pull/102))
- Add performance benchmarks. ([#101](https://github.com/shm11C3/md-hinagata/pull/101))

## 0.1.2

### Added

- Add Create Theme from Default command. ([#84](https://github.com/shm11C3/md-hinagata/pull/84))
- Implement CSS output mode contract. ([#93](https://github.com/shm11C3/md-hinagata/pull/93))
- Implement inline CSS output mode. ([#94](https://github.com/shm11C3/md-hinagata/pull/94))

### Fixed

- Allow PR labeler to update labels. ([#85](https://github.com/shm11C3/md-hinagata/pull/85))

### Documentation

- Remove accidental frontmatter. ([#87](https://github.com/shm11C3/md-hinagata/pull/87))
- Define CSS output modes. ([#91](https://github.com/shm11C3/md-hinagata/pull/91))
- Update task checklist status. ([#92](https://github.com/shm11C3/md-hinagata/pull/92))
- Surface CSS output mode in the extension. ([#95](https://github.com/shm11C3/md-hinagata/pull/95))

### Maintenance

- Automate extension changelog generation from release preparation pull requests. ([#83](https://github.com/shm11C3/md-hinagata/pull/83))

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
