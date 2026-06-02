use std::{collections::BTreeMap, fs, path::PathBuf};

use md_hinagata_core::{
    CssOutputMode, INVALID_FRONTMATTER, MISSING_TEMPLATE, TEMPLATE_RENDER_ERROR, ThemeManifest,
    ThemePackage, ThemeSource, TransformOptions, TransformRequest, UNKNOWN_THEME, transform,
};

#[test]
fn transforms_basic_example_to_expected_html() {
    let article = read_repo_file("examples/basic/sample.md");
    let expected_html = read_repo_file("examples/basic/expected.html");
    let expected_css = read_repo_file("examples/basic/.md-hinagata/themes/basic/styles.css");
    let request = TransformRequest {
        markdown: article,
        themes: vec![basic_example_theme()],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.resolved_theme_id, "basic");
    assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
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
    assert_eq!(response.css.as_deref(), Some(expected_css.as_str()));
    assert!(response.diagnostics.is_empty());
}

#[test]
fn transforms_additional_example_samples_without_diagnostics() {
    for (markdown_path, theme_id, expected_marker) in [
        (
            "examples/basic/knowledge-base.md",
            "docs-clean",
            "docs-heading--h1",
        ),
        (
            "examples/basic/product-update.md",
            "release-note",
            "release-heading--h1",
        ),
        (
            "examples/basic/editorial-article.md",
            "editorial",
            "editorial-title",
        ),
    ] {
        let response = transform(TransformRequest {
            markdown: read_repo_file(markdown_path),
            themes: vec![example_workspace_theme(theme_id)],
            default_theme_id: Some(theme_id.to_owned()),
            options: TransformOptions::default(),
        })
        .expect("transform should succeed");

        assert_eq!(response.resolved_theme_id, theme_id);
        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert_eq!(
            response
                .frontmatter
                .as_ref()
                .and_then(|frontmatter| frontmatter.theme.as_deref()),
            Some(theme_id),
        );
        assert!(
            response.html.contains(expected_marker),
            "{markdown_path} should render theme-specific HTML",
        );
        assert!(
            response.html.contains("<main class=\"mh-document\">"),
            "{markdown_path} should include the document wrapper",
        );
        assert!(
            response.css.as_deref().is_some_and(|css| !css.is_empty()),
            "{theme_id} should include theme CSS",
        );
        assert!(
            response.diagnostics.is_empty(),
            "{markdown_path} diagnostics: {:?}",
            response.diagnostics,
        );
    }
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
fn reports_template_render_error_for_unknown_value_and_uses_element_fallback() {
    let request = TransformRequest {
        markdown: "# Title".to_owned(),
        themes: vec![theme_package("default", [("h1", "<h1>{{titel}}</h1>")])],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<h1 id=\"title\">Title</h1>");
    assert_eq!(response.diagnostics[0].code, TEMPLATE_RENDER_ERROR);
    assert_eq!(
        response.diagnostics[0].message,
        "Failed to render template 'h1': unknown template value 'titel'.",
    );
}

#[test]
fn reports_template_render_error_for_disallowed_raw_value_and_uses_element_fallback() {
    let request = TransformRequest {
        markdown: "Body text.".to_owned(),
        themes: vec![theme_package("default", [("p", "<p>{{{ text }}}</p>")])],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<p>Body text.</p>");
    assert_eq!(response.diagnostics[0].code, TEMPLATE_RENDER_ERROR);
    assert_eq!(
        response.diagnostics[0].message,
        "Failed to render template 'p': raw insertion is not allowed for 'text'.",
    );
}

#[test]
fn renders_compat_raw_codeblock_value_as_escaped_insertion() {
    let request = TransformRequest {
        markdown: ["```", "<script>", "```"].join("\n"),
        themes: vec![theme_package(
            "default",
            [("codeblock", "<pre><code>{{raw}}</code></pre>")],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<pre><code>&lt;script&gt;</code></pre>");
    assert!(response.diagnostics.is_empty());
}

#[test]
fn renders_scalar_list_context_values() {
    let request = TransformRequest {
        markdown: "3. Third".to_owned(),
        themes: vec![theme_package(
            "default",
            [
                (
                    "ol",
                    "<ol data-start=\"{{start}}\" data-ordered=\"{{ordered}}\">{{{inner_html}}}</ol>",
                ),
                ("li", "<li>{{{inner_html}}}</li>"),
            ],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(
        response.html,
        "<ol data-start=\"3\" data-ordered=\"true\"><li>Third</li></ol>",
    );
    assert!(response.diagnostics.is_empty());
}

#[test]
fn reports_template_render_error_for_raw_codeblock_value_and_uses_element_fallback() {
    let request = TransformRequest {
        markdown: ["```", "<script>", "```"].join("\n"),
        themes: vec![theme_package(
            "default",
            [("codeblock", "<pre><code>{{{raw}}}</code></pre>")],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<pre><code>&lt;script&gt;</code></pre>");
    assert_eq!(response.diagnostics[0].code, TEMPLATE_RENDER_ERROR);
    assert_eq!(
        response.diagnostics[0].message,
        "Failed to render template 'codeblock': raw insertion is not allowed for 'raw'.",
    );
}

#[test]
fn reports_template_render_error_for_unclosed_interpolation() {
    let request = TransformRequest {
        markdown: "Body text.".to_owned(),
        themes: vec![theme_package("default", [("p", "<p>{{text</p>")])],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<p>Body text.</p>");
    assert_eq!(response.diagnostics[0].code, TEMPLATE_RENDER_ERROR);
    assert_eq!(
        response.diagnostics[0].message,
        "Failed to render template 'p': unclosed escaped interpolation",
    );
}

#[test]
fn reports_template_render_error_for_unsupported_template_construct() {
    let request = TransformRequest {
        markdown: "Body text.".to_owned(),
        themes: vec![theme_package(
            "default",
            [("p", "<p>{{#if text}}{{text}}{{/if}}</p>")],
        )],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<p>Body text.</p>");
    assert_eq!(response.diagnostics[0].code, TEMPLATE_RENDER_ERROR);
    assert_eq!(
        response.diagnostics[0].message,
        "Failed to render template 'p': unsupported template syntax '#if text'.",
    );
}

#[test]
fn renders_literal_interpolation_delimiters() {
    let request = TransformRequest {
        markdown: "Body text.".to_owned(),
        themes: vec![theme_package("default", [("p", "<p>Use \\{{name}}</p>")])],
        default_theme_id: Some("default".to_owned()),
        options: TransformOptions::default(),
    };

    let response = transform(request).expect("transform should succeed");

    assert_eq!(response.html, "<p>Use {{name}}</p>");
    assert!(response.diagnostics.is_empty());
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

fn example_workspace_theme(theme_id: &str) -> ThemePackage {
    let theme_root = format!("examples/basic/.md-hinagata/themes/{theme_id}");
    let manifest: ThemeManifest =
        serde_json::from_str(&read_repo_file(format!("{theme_root}/theme.json")))
            .expect("example theme manifest should be valid JSON");
    let templates = manifest
        .templates
        .iter()
        .map(|(key, path)| {
            (
                key.to_owned(),
                read_repo_file(format!("{theme_root}/{path}")),
            )
        })
        .collect();
    let css = read_repo_file(format!("{theme_root}/{}", manifest.entry_css));

    ThemePackage {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        source: Some(ThemeSource::Workspace),
        css: Some(css),
        templates,
        manifest: Some(manifest),
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
