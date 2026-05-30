//! Behavior tests for inline link and image rendering.
//!
//! Links and images previously dropped their `href` / `src` because
//! `render_inline` had no arm for `NodeValue::Link` / `NodeValue::Image`.
//! These tests exercise the public `transform` API through a paragraph
//! template that passes `inner_html` straight through, so the assertions
//! observe exactly the inline HTML produced by the renderer.

use std::collections::BTreeMap;

use md_hinagata_core::{ThemePackage, ThemeSource, TransformOptions, TransformRequest, transform};

#[test]
fn link_renders_anchor_with_href() {
    assert_eq!(
        render("[text](https://example.com)"),
        r#"<a href="https://example.com">text</a>"#,
    );
}

#[test]
fn image_renders_self_closing_img_with_src_and_alt() {
    assert_eq!(
        render("![an apple](apple.png)"),
        r#"<img src="apple.png" alt="an apple" />"#,
    );
}

#[test]
fn link_includes_title_when_present() {
    assert_eq!(
        render(r#"[text](https://example.com "Tooltip")"#),
        r#"<a href="https://example.com" title="Tooltip">text</a>"#,
    );
}

#[test]
fn image_includes_title_when_present() {
    assert_eq!(
        render(r#"![an apple](apple.png "A fruit")"#),
        r#"<img src="apple.png" alt="an apple" title="A fruit" />"#,
    );
}

#[test]
fn link_inside_strong_keeps_both_wrappers() {
    assert_eq!(
        render("**[bold](https://example.com)**"),
        r#"<strong><a href="https://example.com">bold</a></strong>"#,
    );
}

#[test]
fn inline_code_inside_link_is_preserved() {
    assert_eq!(
        render("[`code`](https://example.com)"),
        r#"<a href="https://example.com"><code>code</code></a>"#,
    );
}

#[test]
fn link_href_escapes_ampersand() {
    assert_eq!(
        render("[q](https://example.com/?x=1&y=2)"),
        r#"<a href="https://example.com/?x=1&amp;y=2">q</a>"#,
    );
}

#[test]
fn image_src_escapes_ampersand() {
    assert_eq!(
        render("![q](https://example.com/i.png?x=1&y=2)"),
        r#"<img src="https://example.com/i.png?x=1&amp;y=2" alt="q" />"#,
    );
}

fn render(markdown: &str) -> String {
    let response = transform(TransformRequest {
        markdown: markdown.to_owned(),
        themes: vec![passthrough_theme()],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    })
    .expect("transform should succeed");
    response.html
}

/// A theme whose paragraph template emits only the inline HTML, so tests
/// can assert on the renderer's inline output directly.
fn passthrough_theme() -> ThemePackage {
    ThemePackage {
        id: "default".to_owned(),
        name: "default".to_owned(),
        version: "0.1.0".to_owned(),
        source: Some(ThemeSource::Bundled),
        css: None,
        templates: [("p", "{{{inner_html}}}")]
            .into_iter()
            .map(|(key, template)| (key.to_owned(), template.to_owned()))
            .collect::<BTreeMap<_, _>>(),
        manifest: None,
    }
}
