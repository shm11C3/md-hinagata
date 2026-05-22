# md-hinagata Context

md-hinagata is a Markdown-to-HTML authoring context centered on applying named themes to Markdown documents. The language here keeps theme, template, and generated output concepts distinct.

## Language

**Theme**:
A named package that defines how Markdown elements become structured HTML for a document.
_Avoid_: Skin, style-only theme

**Template**:
A per-element pattern inside a **Theme** that shapes the HTML for one Markdown element type.
_Avoid_: Snippet, partial

**Default Theme**:
The baseline **Theme** available without user setup.
_Avoid_: Starter kit, sample theme

**Workspace Theme**:
A user-editable **Theme** that belongs to the current workspace.
_Avoid_: Local template, project skin

**Theme Creation**:
The workflow of creating a new editable **Workspace Theme** by copying the **Default Theme**.
_Avoid_: Template generation, theme import

**Active Theme Selection**:
The document-level choice of which **Theme** applies to the current Markdown document.
_Avoid_: Current skin, preview theme

**Theme Collision**:
A case where **Theme Creation** would create a **Workspace Theme** with an ID that already exists in the target workspace.
_Avoid_: Theme merge, overwrite prompt

**Generated HTML**:
The HTML fragment produced from Markdown after a **Theme** has been applied.
_Avoid_: Preview HTML, export page

**Extension Changelog**:
The versioned release history shown for the VS Code extension package and Marketplace listing.
_Avoid_: Repository changelog, commit log, release notes dump

**Extension Release Preparation**:
A reviewable release step that declares the next VS Code extension version and prepares the **Extension Changelog** before Marketplace publishing.
_Avoid_: Feature PR, publish tag, release automation run

**Changelog Entry**:
A single version section inside the **Extension Changelog** that summarizes merged pull requests for one VS Code extension version.
_Avoid_: Release dump, generated commit list

**Changelog Skip**:
An explicit decision that a pull request should not appear in a **Changelog Entry**.
_Avoid_: Missing label, implicit omission

**Changelog Override**:
A one-line pull request annotation that replaces only the wording of that pull request's generated changelog item.
_Avoid_: Category override, release note body

## Example Dialogue

Dev: "Should the user generate a template?"

Domain expert: "No, they should create a workspace theme from the default theme. The theme contains templates, stylesheet, and metadata."

Dev: "Should creating the workspace theme also change the active document?"

Domain expert: "Yes. Theme creation should update the active theme selection when a Markdown document is active."

Dev: "After that, editing `h2` changes only one template inside the workspace theme?"

Domain expert: "Yes. The generated HTML changes because the active theme now uses that edited template."
