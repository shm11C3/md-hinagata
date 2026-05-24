use serde::{Deserialize, Serialize};

use crate::{
    frontmatter::parse_frontmatter,
    markdown::{parse_markdown_with_options, MarkdownOptions},
    renderer::render_blocks,
    theme::resolve_theme,
    Diagnostic, DiagnosticSource, ParsedFrontmatter, Result, ThemePackage, UNSUPPORTED_CSS_MODE,
};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sanitize: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allow_raw_html: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformRequest {
    pub markdown: String,
    #[serde(default)]
    pub themes: Vec<ThemePackage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_theme_id: Option<String>,
    #[serde(default)]
    pub options: TransformOptions,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformResponse {
    pub html: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
    pub resolved_theme_id: String,
    pub resolved_css_mode: CssOutputMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter: Option<ParsedFrontmatter>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CssOutputMode {
    None,
    Separate,
    StyleTag,
    Inline,
}

pub fn transform(request: TransformRequest) -> Result<TransformResponse> {
    let mut diagnostics = Vec::new();
    let parsed_markdown = parse_frontmatter(&request.markdown);
    diagnostics.extend(parsed_markdown.diagnostics);
    let resolved_css_mode =
        resolve_css_output_mode(parsed_markdown.frontmatter.as_ref(), &mut diagnostics);

    let theme = resolve_theme(
        &request.themes,
        parsed_markdown
            .frontmatter
            .as_ref()
            .and_then(|frontmatter| frontmatter.theme.as_deref()),
        request.default_theme_id.as_deref(),
        &mut diagnostics,
    );
    let resolved_theme_id = theme.map(|theme| theme.id.clone()).unwrap_or_default();
    let blocks = parse_markdown_with_options(
        &parsed_markdown.markdown,
        MarkdownOptions {
            allow_raw_html: request.options.allow_raw_html.unwrap_or(false),
        },
    );
    let css = theme.and_then(|theme| theme.css.clone());
    let rendered_html = render_blocks(&blocks, theme, &mut diagnostics);
    let output = compose_generated_output(&rendered_html, css.as_deref(), resolved_css_mode);

    Ok(TransformResponse {
        html: output.html,
        css: output.css,
        resolved_theme_id,
        resolved_css_mode,
        frontmatter: parsed_markdown.frontmatter,
        diagnostics,
    })
}

struct GeneratedOutput {
    html: String,
    css: Option<String>,
}

fn resolve_css_output_mode(
    frontmatter: Option<&ParsedFrontmatter>,
    diagnostics: &mut Vec<Diagnostic>,
) -> CssOutputMode {
    let Some(raw_css_mode) = frontmatter.and_then(|frontmatter| frontmatter.css_mode.as_deref())
    else {
        return CssOutputMode::StyleTag;
    };
    let css_mode = raw_css_mode.trim();

    match css_mode {
        "none" => CssOutputMode::None,
        "separate" => CssOutputMode::Separate,
        "style-tag" => CssOutputMode::StyleTag,
        "inline" => {
            diagnostics.push(unsupported_css_mode_diagnostic(css_mode));
            CssOutputMode::StyleTag
        }
        unsupported_css_mode => {
            diagnostics.push(unsupported_css_mode_diagnostic(unsupported_css_mode));
            CssOutputMode::StyleTag
        }
    }
}

fn unsupported_css_mode_diagnostic(value: &str) -> Diagnostic {
    Diagnostic::warning(
        UNSUPPORTED_CSS_MODE,
        format!("Unsupported hinagata.cssMode '{value}'; falling back to 'style-tag'."),
    )
    .with_source(DiagnosticSource::Frontmatter)
}

fn compose_generated_output(
    rendered_html: &str,
    css: Option<&str>,
    css_mode: CssOutputMode,
) -> GeneratedOutput {
    match css_mode {
        CssOutputMode::None => GeneratedOutput {
            html: wrap_document_html(rendered_html),
            css: None,
        },
        CssOutputMode::Separate => GeneratedOutput {
            html: wrap_document_html(rendered_html),
            css: css.map(str::to_owned),
        },
        CssOutputMode::StyleTag | CssOutputMode::Inline => GeneratedOutput {
            html: compose_style_tag_html(rendered_html, css),
            css: css.map(str::to_owned),
        },
    }
}

fn compose_style_tag_html(rendered_html: &str, css: Option<&str>) -> String {
    let Some(css) = css.map(str::trim_end).filter(|css| !css.is_empty()) else {
        return rendered_html.to_owned();
    };
    let document_html = wrap_document_html(rendered_html);

    [
        "<style>",
        escape_style_text(css).as_str(),
        "</style>",
        document_html.as_str(),
    ]
    .join("\n")
}

fn wrap_document_html(rendered_html: &str) -> String {
    if rendered_html.is_empty() {
        return "<main class=\"mh-document\"></main>".to_owned();
    }

    ["<main class=\"mh-document\">", rendered_html, "</main>"].join("\n")
}

fn escape_style_text(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    let mut remaining = value;

    while let Some(index) = remaining.to_ascii_lowercase().find("</style") {
        escaped.push_str(&remaining[..index]);
        escaped.push_str("<\\/style");
        remaining = &remaining[index + "</style".len()..];
    }

    escaped.push_str(remaining);
    escaped
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use crate::{
        DiagnosticSource, ThemeSource, MISSING_TEMPLATE, UNKNOWN_THEME, UNSUPPORTED_CSS_MODE,
    };
    use serde_json::json;

    #[test]
    fn transform_request_uses_json_friendly_field_names() {
        let request: TransformRequest = serde_json::from_value(json!({
            "markdown": "# Title",
            "themes": [],
            "defaultThemeId": "default",
            "options": {
                "allowRawHtml": false,
                "sanitize": true
            }
        }))
        .expect("request should deserialize");

        assert_eq!(request.default_theme_id.as_deref(), Some("default"));
        assert_eq!(request.options.allow_raw_html, Some(false));

        let serialized = serde_json::to_value(&request).expect("request should serialize");
        assert_eq!(serialized["defaultThemeId"], "default");
        assert_eq!(serialized["options"]["allowRawHtml"], false);
    }

    #[test]
    fn transform_response_can_include_diagnostics_and_frontmatter() {
        let response = TransformResponse {
            html: "<h1>Hello</h1>".to_owned(),
            css: None,
            resolved_theme_id: "default".to_owned(),
            resolved_css_mode: CssOutputMode::StyleTag,
            frontmatter: Some(ParsedFrontmatter {
                theme: Some("default".to_owned()),
                output: Some("fragment".to_owned()),
                css_mode: Some("style-tag".to_owned()),
            }),
            diagnostics: vec![Diagnostic::warning(
                "missing-template",
                "Template h2.hbs is missing.",
            )],
        };

        let serialized = serde_json::to_value(&response).expect("response should serialize");

        assert_eq!(serialized["resolvedThemeId"], "default");
        assert_eq!(serialized["resolvedCssMode"], "style-tag");
        assert_eq!(serialized["frontmatter"]["theme"], "default");
        assert_eq!(serialized["frontmatter"]["cssMode"], "style-tag");
        assert_eq!(serialized["diagnostics"][0]["severity"], "warning");
        assert_eq!(serialized["diagnostics"][0]["code"], "missing-template");
    }

    #[test]
    fn transform_exposes_minimal_public_api() {
        let request = TransformRequest {
            markdown: "# Title".to_owned(),
            themes: vec![theme_package(
                "default",
                Some(".mh-document {}"),
                [("h1", "<h1 id=\"{{id}}\">{{{inner_html}}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_theme_id, "default");
        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert_eq!(
            response.html,
            [
                "<style>",
                ".mh-document {}",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1 id=\"title\">Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert_eq!(response.css.as_deref(), Some(".mh-document {}"));
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_defaults_missing_css_mode_to_style_tag() {
        let request = TransformRequest {
            markdown: "# Title".to_owned(),
            themes: vec![theme_package(
                "default",
                Some(".mh-document {}"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert_eq!(
            response.html,
            [
                "<style>",
                ".mh-document {}",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1>Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert_eq!(response.css.as_deref(), Some(".mh-document {}"));
    }

    #[test]
    fn transform_renders_basic_markdown_with_theme_templates() {
        let request = TransformRequest {
            markdown: [
                "# Welcome to md-hinagata",
                "",
                "Write Markdown and copy controlled HTML.",
                "",
                "## Code example",
                "",
                "```ts",
                "const message = \"hello\";",
                "```",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                None,
                [
                    (
                        "h1",
                        "<h1 id=\"{{id}}\" class=\"heading heading--h1\">\n  {{{inner_html}}}\n</h1>",
                    ),
                    (
                        "h2",
                        "<h2 id=\"{{id}}\" class=\"heading heading--h2\">\n  {{{inner_html}}}\n</h2>",
                    ),
                    ("p", "<p class=\"paragraph\">\n  {{{inner_html}}}\n</p>"),
                    (
                        "codeblock",
                        "<pre class=\"codeblock\"><code class=\"language-{{lang}}\">{{code}}</code></pre>",
                    ),
                ],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "<h1 id=\"welcome-to-md-hinagata\" class=\"heading heading--h1\">",
                "  Welcome to md-hinagata",
                "</h1>",
                "<p class=\"paragraph\">",
                "  Write Markdown and copy controlled HTML.",
                "</p>",
                "<h2 id=\"code-example\" class=\"heading heading--h2\">",
                "  Code example",
                "</h2>",
                "<pre class=\"codeblock\"><code class=\"language-ts\">const message = &quot;hello&quot;;</code></pre>",
            ]
            .join("\n"),
        );
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_renders_blockquote_and_lists_with_theme_templates() {
        let request = TransformRequest {
            markdown: [
                "> Quoted **text**.",
                "",
                "- First item",
                "- Second item",
                "",
                "3. First ordered",
                "4. Second ordered",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                None,
                [
                    ("p", "<p class=\"paragraph\">{{{inner_html}}}</p>"),
                    (
                        "blockquote",
                        "<blockquote class=\"quote\">\n{{{inner_html}}}\n</blockquote>",
                    ),
                    (
                        "ul",
                        "<ul class=\"list unordered\">\n{{{inner_html}}}\n</ul>",
                    ),
                    (
                        "ol",
                        "<ol class=\"list ordered\" start=\"{{start}}\">\n{{{inner_html}}}\n</ol>",
                    ),
                    ("li", "<li class=\"item\">{{{inner_html}}}</li>"),
                ],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "<blockquote class=\"quote\">",
                "<p class=\"paragraph\">Quoted <strong>text</strong>.</p>",
                "</blockquote>",
                "<ul class=\"list unordered\">",
                "<li class=\"item\">First item</li>",
                "<li class=\"item\">Second item</li>",
                "</ul>",
                "<ol class=\"list ordered\" start=\"3\">",
                "<li class=\"item\">First ordered</li>",
                "<li class=\"item\">Second ordered</li>",
                "</ol>",
            ]
            .join("\n"),
        );
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_escapes_raw_html_by_default() {
        let request = TransformRequest {
            markdown: ["<script>alert(1)</script>", "", "Hello <em>there</em>"].join("\n"),
            themes: vec![theme_package(
                "default",
                None,
                [("p", "<p>{{{inner_html}}}</p>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "&lt;script&gt;alert(1)&lt;/script&gt;",
                "<p>Hello &lt;em&gt;there&lt;/em&gt;</p>",
            ]
            .join("\n"),
        );
        assert!(!response.html.contains("<script>"));
        assert!(!response.html.contains("<em>there</em>"));
    }

    #[test]
    fn transform_escapes_raw_html_when_explicitly_disabled() {
        let request = TransformRequest {
            markdown: ["<script>alert(1)</script>", "", "Hello <em>there</em>"].join("\n"),
            themes: vec![theme_package(
                "default",
                None,
                [("p", "<p>{{{inner_html}}}</p>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions {
                allow_raw_html: Some(false),
                sanitize: None,
            },
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "&lt;script&gt;alert(1)&lt;/script&gt;",
                "<p>Hello &lt;em&gt;there&lt;/em&gt;</p>",
            ]
            .join("\n"),
        );
    }

    #[test]
    fn transform_can_allow_raw_html_for_future_opt_in_paths() {
        let request = TransformRequest {
            markdown: ["<div>Raw</div>", "", "Hello <em>there</em>"].join("\n"),
            themes: vec![theme_package(
                "default",
                None,
                [("p", "<p>{{{inner_html}}}</p>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions {
                allow_raw_html: Some(true),
                sanitize: None,
            },
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            ["<div>Raw</div>", "<p>Hello <em>there</em></p>"].join("\n"),
        );
    }

    #[test]
    fn transform_falls_back_when_default_theme_id_is_unknown() {
        let request = TransformRequest {
            markdown: "# Title".to_owned(),
            themes: vec![
                theme_package(
                    "fallback",
                    Some(".fallback {}"),
                    [("h1", "<h1>{{text}}</h1>")],
                ),
                theme_package("other", Some(".other {}"), [("h1", "<h1>{{text}}</h1>")]),
            ],
            default_theme_id: Some("missing".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_theme_id, "fallback");
        assert_eq!(response.css.as_deref(), Some(".fallback {}"));
        assert_eq!(
            response.html,
            [
                "<style>",
                ".fallback {}",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1>Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert_eq!(response.diagnostics[0].code, UNKNOWN_THEME);
    }

    #[test]
    fn transform_includes_theme_css_in_generated_html() {
        let request = TransformRequest {
            markdown: "# Title".to_owned(),
            themes: vec![theme_package(
                "default",
                Some("body::after { content: '</style>'; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "<style>",
                "body::after { content: '<\\/style>'; }",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1>Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert_eq!(
            response.css.as_deref(),
            Some("body::after { content: '</style>'; }"),
        );
    }

    #[test]
    fn transform_css_mode_none_omits_css_from_html_and_response_css() {
        let request = TransformRequest {
            markdown: ["---", "hinagata:", "  cssMode: none", "---", "", "# Title"].join("\n"),
            themes: vec![theme_package(
                "default",
                Some(".mh-document { color: red; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::None);
        assert_eq!(
            response.html,
            ["<main class=\"mh-document\">", "<h1>Title</h1>", "</main>",].join("\n"),
        );
        assert_eq!(response.css, None);
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_css_mode_separate_returns_document_html_and_response_css() {
        let request = TransformRequest {
            markdown: [
                "---",
                "hinagata:",
                "  cssMode: separate",
                "---",
                "",
                "# Title",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                Some(".mh-document { color: red; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::Separate);
        assert_eq!(
            response.html,
            ["<main class=\"mh-document\">", "<h1>Title</h1>", "</main>",].join("\n"),
        );
        assert_eq!(
            response.css.as_deref(),
            Some(".mh-document { color: red; }")
        );
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_css_mode_style_tag_includes_theme_css_in_html() {
        let request = TransformRequest {
            markdown: [
                "---",
                "hinagata:",
                "  cssMode: style-tag",
                "---",
                "",
                "# Title",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                Some(".mh-document { color: red; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert_eq!(
            response.html,
            [
                "<style>",
                ".mh-document { color: red; }",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1>Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert_eq!(
            response.css.as_deref(),
            Some(".mh-document { color: red; }")
        );
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_warns_and_falls_back_for_invalid_css_mode() {
        let request = TransformRequest {
            markdown: [
                "---",
                "hinagata:",
                "  cssMode: unsupported",
                "---",
                "",
                "# Title",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                Some(".mh-document { color: red; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert_eq!(
            response.html,
            [
                "<style>",
                ".mh-document { color: red; }",
                "</style>",
                "<main class=\"mh-document\">",
                "<h1>Title</h1>",
                "</main>",
            ]
            .join("\n"),
        );
        assert!(response.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == UNSUPPORTED_CSS_MODE
                && diagnostic.source == Some(DiagnosticSource::Frontmatter)
        }));
    }

    #[test]
    fn transform_warns_and_falls_back_for_inline_css_mode_until_supported() {
        let request = TransformRequest {
            markdown: [
                "---",
                "hinagata:",
                "  cssMode: inline",
                "---",
                "",
                "# Title",
            ]
            .join("\n"),
            themes: vec![theme_package(
                "default",
                Some(".mh-document { color: red; }"),
                [("h1", "<h1>{{text}}</h1>")],
            )],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_css_mode, CssOutputMode::StyleTag);
        assert!(response.diagnostics.iter().any(|diagnostic| {
            diagnostic.code == UNSUPPORTED_CSS_MODE
                && diagnostic.source == Some(DiagnosticSource::Frontmatter)
        }));
    }

    #[test]
    fn transform_falls_back_when_a_template_is_missing() {
        let request = TransformRequest {
            markdown: "Body text.".to_owned(),
            themes: vec![theme_package("default", None, [])],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.html, "<p>Body text.</p>");
        assert_eq!(response.diagnostics[0].code, MISSING_TEMPLATE);
    }

    #[test]
    fn transform_falls_back_when_nested_block_templates_are_missing() {
        let request = TransformRequest {
            markdown: ["> Quoted text.", "", "- First item"].join("\n"),
            themes: vec![theme_package("default", None, [])],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(
            response.html,
            [
                "<blockquote>",
                "<p>Quoted text.</p>",
                "</blockquote>",
                "<ul>",
                "<li>First item</li>",
                "</ul>",
            ]
            .join("\n"),
        );
        assert!(["p", "blockquote", "li", "ul"]
            .iter()
            .all(|template_key| response
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == MISSING_TEMPLATE
                    && diagnostic.message == format!("Template '{template_key}' is missing."))));
    }

    fn theme_package<const N: usize>(
        id: &str,
        css: Option<&str>,
        templates: [(&str, &str); N],
    ) -> ThemePackage {
        ThemePackage {
            id: id.to_owned(),
            name: id.to_owned(),
            version: "0.1.0".to_owned(),
            source: Some(ThemeSource::Bundled),
            css: css.map(str::to_owned),
            templates: templates
                .into_iter()
                .map(|(key, template)| (key.to_owned(), template.to_owned()))
                .collect::<BTreeMap<_, _>>(),
            manifest: None,
        }
    }
}
