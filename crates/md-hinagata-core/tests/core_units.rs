//! Integration-level coverage for small public units that previously had
//! gaps: `CoreError`, theme resolution fallbacks, and `parse_frontmatter`
//! branch behavior.

use std::collections::BTreeMap;

use md_hinagata_core::error::CoreError;
use md_hinagata_core::theme::{find_theme, resolve_theme};
use md_hinagata_core::{Diagnostic, ParsedMarkdown, ThemeManifest, ThemePackage, parse_frontmatter};

fn theme(id: &str) -> ThemePackage {
    ThemePackage {
        id: id.to_owned(),
        name: id.to_owned(),
        version: "0.1.0".to_owned(),
        source: None,
        css: None,
        templates: BTreeMap::new(),
        manifest: None,
    }
}

#[test]
fn core_error_exposes_message_and_display() {
    let error = CoreError::new("boom");
    assert_eq!(error.message(), "boom");
    assert_eq!(error.to_string(), "boom");
}

#[test]
fn core_error_accepts_owned_and_borrowed_messages() {
    let from_str = CoreError::new("static message");
    let from_string = CoreError::new(String::from("static message"));
    assert_eq!(from_str, from_string);
    assert_eq!(from_str.clone(), from_str);
}

#[test]
fn core_error_implements_std_error() {
    fn assert_is_error<E: std::error::Error>(_: &E) {}
    let error = CoreError::new("as std error");
    assert_is_error(&error);
}

#[test]
fn resolve_theme_returns_requested_theme_without_diagnostics() {
    let themes = [theme("default"), theme("basic")];
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    let resolved = resolve_theme(&themes, Some("basic"), Some("default"), &mut diagnostics);

    assert_eq!(resolved.map(|theme| theme.id.as_str()), Some("basic"));
    assert!(diagnostics.is_empty());
}

#[test]
fn resolve_theme_falls_back_to_default_when_request_is_missing() {
    let themes = [theme("default"), theme("basic")];
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    let resolved = resolve_theme(&themes, Some("unknown"), Some("default"), &mut diagnostics);

    assert_eq!(resolved.map(|theme| theme.id.as_str()), Some("default"));
    assert_eq!(diagnostics.len(), 1);
}

#[test]
fn resolve_theme_falls_back_to_first_theme_when_default_is_missing() {
    let themes = [theme("default"), theme("basic")];
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    let resolved = resolve_theme(&themes, Some("unknown"), Some("also-missing"), &mut diagnostics);

    assert_eq!(resolved.map(|theme| theme.id.as_str()), Some("default"));
    assert_eq!(diagnostics.len(), 2);
}

#[test]
fn resolve_theme_returns_none_for_empty_theme_list() {
    let themes: [ThemePackage; 0] = [];
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    let resolved = resolve_theme(&themes, Some("x"), Some("y"), &mut diagnostics);

    assert!(resolved.is_none());
    assert_eq!(diagnostics.len(), 2);
}

#[test]
fn resolve_theme_uses_default_directly_when_no_theme_is_requested() {
    let themes = [theme("default"), theme("basic")];
    let mut diagnostics: Vec<Diagnostic> = Vec::new();

    let resolved = resolve_theme(&themes, None, Some("basic"), &mut diagnostics);

    assert_eq!(resolved.map(|theme| theme.id.as_str()), Some("basic"));
    assert!(diagnostics.is_empty());
}

#[test]
fn find_theme_matches_by_id() {
    let themes = [theme("default"), theme("basic")];
    assert_eq!(
        find_theme(&themes, "basic").map(|theme| theme.id.as_str()),
        Some("basic")
    );
    assert!(find_theme(&themes, "missing").is_none());
}

#[test]
fn theme_manifest_equality_is_structural() {
    let make = || ThemeManifest {
        schema_version: Some("0.1".to_owned()),
        id: "eq".to_owned(),
        name: "Eq".to_owned(),
        version: "0.1.0".to_owned(),
        entry_css: "styles.css".to_owned(),
        templates: BTreeMap::new(),
    };
    assert_eq!(make(), make());
}

#[test]
fn frontmatter_parses_hinagata_namespace_with_body() {
    let source = "---\nhinagata:\n  theme: basic\n  output: fragment\n  cssMode: inline\n---\n# Body\n";
    let parsed = parse_frontmatter(source);
    let frontmatter = parsed.frontmatter.expect("frontmatter should be parsed");
    assert_eq!(frontmatter.theme.as_deref(), Some("basic"));
    assert_eq!(frontmatter.output.as_deref(), Some("fragment"));
    assert_eq!(frontmatter.css_mode.as_deref(), Some("inline"));
    assert_eq!(parsed.markdown.trim(), "# Body");
    assert!(parsed.diagnostics.is_empty());
}

#[test]
fn frontmatter_strips_surrounding_quotes_from_values() {
    let source = "---\nhinagata:\n  theme: \"quoted\"\n  output: 'single'\n---\nbody";
    let frontmatter = parse_frontmatter(source)
        .frontmatter
        .expect("frontmatter should be parsed");
    assert_eq!(frontmatter.theme.as_deref(), Some("quoted"));
    assert_eq!(frontmatter.output.as_deref(), Some("single"));
}

#[test]
fn frontmatter_handles_block_terminated_at_end_of_input() {
    // No trailing body: the block ends with `\n---` at end of input.
    let source = "---\nhinagata:\n  theme: basic\n---";
    let parsed = parse_frontmatter(source);
    let frontmatter = parsed.frontmatter.expect("frontmatter should be parsed");
    assert_eq!(frontmatter.theme.as_deref(), Some("basic"));
    assert_eq!(parsed.markdown, "");
}

#[test]
fn frontmatter_supports_crlf_opening_delimiter() {
    let source = "---\r\nhinagata:\r\n  theme: basic\r\n---\r\nbody";
    let frontmatter = parse_frontmatter(source)
        .frontmatter
        .expect("frontmatter should be parsed");
    assert_eq!(frontmatter.theme.as_deref(), Some("basic"));
}

#[test]
fn frontmatter_reports_missing_closing_delimiter() {
    let source = "---\nhinagata:\n  theme: basic\n";
    let parsed = parse_frontmatter(source);
    assert!(parsed.frontmatter.is_none());
    assert_eq!(parsed.diagnostics.len(), 1);
}

#[test]
fn frontmatter_reports_unparseable_yaml() {
    let source = "---\nhinagata: [\n---\nbody";
    let parsed = parse_frontmatter(source);
    assert!(parsed.frontmatter.is_none());
    assert_eq!(parsed.diagnostics.len(), 1);
    assert_eq!(parsed.markdown, "body");
}

#[test]
fn frontmatter_absent_when_document_has_no_delimiters() {
    let parsed: ParsedMarkdown = parse_frontmatter("# Just a heading\n");
    assert!(parsed.frontmatter.is_none());
    assert!(parsed.diagnostics.is_empty());
    assert_eq!(parsed.markdown, "# Just a heading\n");
}
