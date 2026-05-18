//! CommonMark conformance harness for md-hinagata's Markdown parser.
//!
//! The fixture under `tests/fixtures/commonmark/mvp-block-elements.json`
//! is a curated subset of the official CommonMark 0.31.2 spec examples,
//! restricted to the documented `0.1.0` MVP block elements:
//!
//! ```txt
//! h1, h2, h3, p, codeblock, blockquote, ul, ol, li
//! ```
//!
//! md-hinagata transforms Markdown into theme-controlled HTML rather than
//! acting as a generic CommonMark renderer, so the harness runs the
//! transform with no theme (which falls back to comrak-rendered HTML),
//! normalizes both sides for the two documented intentional differences,
//! and compares. Examples that are out of MVP scope are listed in
//! [`KNOWN_DIFFERENT`] with the reason searchable in this file.

use std::{collections::HashMap, fs, path::PathBuf};

use md_hinagata_core::{transform, TransformOptions, TransformRequest};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct Fixture {
    #[serde(rename = "commonmarkVersion")]
    commonmark_version: String,
    examples: Vec<Example>,
}

#[derive(Debug, Deserialize)]
struct Example {
    example: u32,
    section: String,
    markdown: String,
    #[serde(rename = "expectedHtml")]
    expected_html: String,
}

/// CommonMark spec examples that intentionally differ from md-hinagata
/// behavior. Keep the reason explicit and grep-friendly: when adding a
/// new entry, document *why* the difference is intentional rather than a
/// regression.
const KNOWN_DIFFERENT: &[(u32, &str)] = &[
    (
        96,
        "Thematic break (`---`) is outside the 0.1.0 MVP block element set; comrak emits an empty block which md-hinagata drops.",
    ),
    (
        98,
        "Thematic break (`---`) is outside the 0.1.0 MVP block element set; comrak emits an empty block which md-hinagata drops.",
    ),
    (
        308,
        "Raw HTML comments are escaped by default (see `TransformOptions::allow_raw_html`).",
    ),
    (
        309,
        "Raw HTML comments are escaped by default (see `TransformOptions::allow_raw_html`).",
    ),
];

#[test]
fn commonmark_mvp_block_elements_match_spec() {
    let fixture = load_fixture();
    assert_eq!(
        fixture.commonmark_version, "0.31.2",
        "fixture version pinned to the documented CommonMark spec",
    );
    assert!(
        !fixture.examples.is_empty(),
        "fixture must contain at least one example",
    );

    let known: HashMap<u32, &str> = KNOWN_DIFFERENT.iter().copied().collect();

    let mut passed = 0usize;
    let mut known_different = 0usize;
    let mut regressions: Vec<String> = Vec::new();
    let mut surprise_matches: Vec<String> = Vec::new();

    for example in &fixture.examples {
        let actual = run_parser(&example.markdown);
        let actual_n = normalize(&actual);
        let expected_n = normalize(&example.expected_html);
        let matches = actual_n == expected_n;
        let known_reason = known.get(&example.example).copied();

        match (matches, known_reason) {
            (true, None) => passed += 1,
            (false, Some(_)) => known_different += 1,
            (false, None) => regressions.push(format_diff(example, &expected_n, &actual_n)),
            (true, Some(reason)) => surprise_matches.push(format!(
                "example {} ({}) now matches the spec; remove from KNOWN_DIFFERENT.\nreason was: {}",
                example.example, example.section, reason,
            )),
        }
    }

    eprintln!(
        "CommonMark {} MVP-block conformance: {} passed, {} known-different (of {} examples)",
        fixture.commonmark_version,
        passed,
        known_different,
        fixture.examples.len(),
    );

    assert!(
        regressions.is_empty(),
        "{} unexpected CommonMark difference(s):\n{}",
        regressions.len(),
        regressions.join("\n"),
    );
    assert!(
        surprise_matches.is_empty(),
        "{} entry/entries in KNOWN_DIFFERENT now match the spec:\n{}",
        surprise_matches.len(),
        surprise_matches.join("\n"),
    );
}

#[test]
fn commonmark_fixture_covers_each_mvp_block_section() {
    let fixture = load_fixture();
    let required = [
        "ATX headings",
        "Setext headings",
        "Paragraphs",
        "Fenced code blocks",
        "Indented code blocks",
        "Block quotes",
        "List items",
        "Lists",
    ];
    for section in required {
        assert!(
            fixture
                .examples
                .iter()
                .any(|example| example.section == section),
            "expected at least one CommonMark example in section '{section}'",
        );
    }
}

fn run_parser(markdown: &str) -> String {
    // No themes means render_blocks falls back to comrak-rendered HTML,
    // which gives parser-level output suitable for spec comparison.
    let request = TransformRequest {
        markdown: markdown.to_owned(),
        themes: Vec::new(),
        default_theme_id: None,
        options: TransformOptions::default(),
    };
    let response = transform(request).expect("transform should succeed");
    response.html
}

fn normalize(html: &str) -> String {
    let stripped = strip_heading_id(html);
    // md-hinagata intentionally trims the trailing newline inside code blocks;
    // the CommonMark spec keeps it. Normalize the spec side so the harness
    // focuses on structural conformance instead of this single documented
    // formatting difference.
    let stripped = stripped.replace("\n</code></pre>", "</code></pre>");
    stripped.trim_end().replace("\r\n", "\n")
}

fn strip_heading_id(html: &str) -> String {
    // md-hinagata injects an `id="..."` slug attribute on h1-h3 headings.
    // The CommonMark spec output has no id attribute, so strip it from the
    // actual side before comparison.
    let pattern =
        regex::Regex::new(r#"<(h[1-3])([^>]*) id="[^"]*"([^>]*)>"#).expect("static regex compiles");
    pattern.replace_all(html, "<$1$2$3>").into_owned()
}

fn format_diff(example: &Example, expected: &str, actual: &str) -> String {
    format!(
        "  example {} ({})\n    markdown: {:?}\n    expected: {:?}\n    actual:   {:?}",
        example.example, example.section, example.markdown, expected, actual,
    )
}

fn load_fixture() -> Fixture {
    let path = fixture_path();
    let contents = fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("failed to read {}: {err}", path.display()));
    serde_json::from_str(&contents)
        .unwrap_or_else(|err| panic!("failed to parse {}: {err}", path.display()))
}

fn fixture_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("commonmark")
        .join("mvp-block-elements.json")
}
