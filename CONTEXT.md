# md-hinagata Context

md-hinagata is a Markdown-to-HTML authoring context centered on applying named themes to Markdown documents. The language here keeps theme, template, and generated output concepts distinct.

## Language

**Theme**:
A named package that defines how Markdown elements become structured HTML for a document.
_Avoid_: Skin, style-only theme

**Template**:
A per-element pattern inside a **Theme** that shapes the HTML for one Markdown element type.
_Avoid_: Snippet, partial

**Template File Format**:
The first-class file format used to store editable **Templates** inside a **Theme**. It is distinct from **Template Interpolation**, which is the value-insertion surface used inside the file.
_Avoid_: Extension-only rename, Handlebars format, generic template file

**Template Interpolation**:
The limited value-insertion surface a **Template** uses to place Markdown-derived values into shaped HTML.
_Avoid_: Template programming, full Handlebars support, helpers, partials

**Raw Template Value**:
A Markdown-derived value that a **Template** may insert as already-shaped HTML through **Template Interpolation**.
_Avoid_: Arbitrary raw variable, unsafe template output

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

**Document Frontmatter**:
The document-level metadata at the beginning of a Markdown document that holds md-hinagata choices under the `hinagata` namespace.
_Avoid_: Front-matter, YAML header

**Frontmatter Schema**:
The supported shape of md-hinagata-specific choices inside **Document Frontmatter**. It defines the block-mapping `hinagata` namespace and supported keys, not the full YAML grammar for unrelated document metadata.
_Avoid_: Theme schema, YAML header format, general YAML parser contract

**Generated HTML**:
The HTML fragment produced from Markdown after a **Theme** has been applied.
_Avoid_: Preview HTML, export page

**Output Mode**:
The document-level choice of the shape of **Generated HTML**, such as a fragment rather than a full document.
_Avoid_: CSS mode, copy mode

**CSS Output Mode**:
The document-level choice of how Theme CSS is carried with or kept apart from **Generated HTML**.
_Avoid_: Output mode, preview styling

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

Dev: "Can a template contain loops or helper logic?"

Domain expert: "No. Templates use template interpolation to place known values into HTML; they do not define template programs."

Dev: "Is the template file format just Handlebars with a different extension?"

Domain expert: "No. The template file format stores editable templates, while template interpolation is the limited value-insertion surface inside those files."

Dev: "Can any template value be inserted as HTML?"

Domain expert: "No. Only named raw template values can be inserted as HTML; other values are inserted as escaped text."
