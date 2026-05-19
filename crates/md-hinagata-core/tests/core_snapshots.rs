use std::{collections::BTreeMap, fs, path::PathBuf};

use md_hinagata_core::{
    transform, ThemePackage, ThemeSource, TransformOptions, TransformRequest, INVALID_FRONTMATTER,
    MISSING_TEMPLATE, UNKNOWN_THEME,
};

#[test]
fn transforms_basic_example_to_expected_html() {
    let article = read_repo_file("examples/basic/sample.md");
    let expected_html = read_repo_file("examples/basic/expected.html");
    let request = TransformRequest {
        markdown: article,
        themes: vec![basic_example_theme()],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.resolved_theme_id, "basic");
    assert_eq!(
        response
            .frontmatter
            .as_ref()
            .and_then(|frontmatter| frontmatter.theme.as_deref()),
        Some("basic"),
    );
    assert_eq!(
        response
            .frontmatter
            .as_ref()
            .and_then(|frontmatter| frontmatter.output.as_deref()),
        Some("fragment"),
    );
    assert_eq!(response.html, expected_html.trim_end());
    assert!(response.diagnostics.is_empty());
}

#[test]
fn reports_unknown_theme_and_falls_back_to_default_theme() {
    let request = TransformRequest {
        markdown: [
            "---",
            "hinagata:",
            "  theme: missing",
            "  output: fragment",
            "---",
            "",
            "# Title",
        ]
        .join("\n"),
        themes: vec![theme_package(
            "default",
            [("h1", "<h1 id=\"{{id}}\">{{{inner_html}}}</h1>")],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.resolved_theme_id, "default");
    assert_eq!(response.html, "<h1 id=\"title\">Title</h1>");
    assert_eq!(response.diagnostics[0].code, UNKNOWN_THEME);
}

#[test]
fn reports_missing_template_and_uses_builtin_fallback() {
    let request = TransformRequest {
        markdown: "Body text.".to_owned(),
        themes: vec![theme_package("default", [])],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<p>Body text.</p>");
    assert_eq!(response.diagnostics[0].code, MISSING_TEMPLATE);
}

#[test]
fn reports_invalid_frontmatter_without_silently_accepting_it() {
    let request = TransformRequest {
        markdown: ["---", "hinagata:", "  theme: [", "---", "", "# Title"].join("\n"),
        themes: vec![theme_package(
            "default",
            [("h1", "<h1 id=\"{{id}}\">{{{inner_html}}}</h1>")],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.resolved_theme_id, "default");
    assert_eq!(response.frontmatter, None);
    assert_eq!(response.html, "<h1 id=\"title\">Title</h1>");
    assert_eq!(response.diagnostics[0].code, INVALID_FRONTMATTER);
}

fn basic_example_theme() -> ThemePackage {
    ThemePackage {
        id: "basic".to_owned(),
        name: "Basic Example".to_owned(),
        version: "0.1.0".to_owned(),
        source: Some(ThemeSource::Workspace),
        css: Some(read_repo_file(
            "examples/basic/.md-hinagata/themes/basic/styles.css",
        )),
        templates: [
            ("h1", "templates/h1.hbs"),
            ("h2", "templates/h2.hbs"),
            ("h3", "templates/h3.hbs"),
            ("p", "templates/p.hbs"),
            ("codeblock", "templates/codeblock.hbs"),
        ]
        .into_iter()
        .map(|(key, path)| {
            (
                key.to_owned(),
                read_repo_file(format!("examples/basic/.md-hinagata/themes/basic/{path}")),
            )
        })
        .collect(),
        manifest: None,
    }
}

fn theme_package<const N: usize>(id: &str, templates: [(&str, &str); N]) -> ThemePackage {
    ThemePackage {
        id: id.to_owned(),
        name: id.to_owned(),
        version: "0.1.0".to_owned(),
        source: Some(ThemeSource::Bundled),
        css: None,
        templates: templates
            .into_iter()
            .map(|(key, template)| (key.to_owned(), template.to_owned()))
            .collect::<BTreeMap<_, _>>(),
        manifest: None,
    }
}

fn read_repo_file(path: impl AsRef<str>) -> String {
    fs::read_to_string(repo_root().join(path.as_ref())).expect("fixture should be readable")
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|path| path.parent())
        .expect("crate should live under crates/md-hinagata-core")
        .to_path_buf()
}
