pub mod diagnostics;
pub mod error;
pub mod frontmatter;
pub mod markdown;
pub mod renderer;
pub mod template;
pub mod theme;
pub mod transform;

pub use diagnostics::{
    Diagnostic, DiagnosticRange, DiagnosticSeverity, DiagnosticSource, MISSING_TEMPLATE,
    TEMPLATE_RENDER_ERROR, UNKNOWN_THEME,
};
pub use error::{CoreError, Result};
pub use frontmatter::ParsedFrontmatter;
pub use markdown::MarkdownBlock;
pub use theme::{ThemeManifest, ThemePackage, ThemeSource};
pub use transform::{transform, TransformOptions, TransformRequest, TransformResponse};

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;
    use serde_json::json;

    #[test]
    fn exposes_package_version() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }

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
            frontmatter: Some(ParsedFrontmatter {
                theme: Some("default".to_owned()),
                output: Some("fragment".to_owned()),
            }),
            diagnostics: vec![Diagnostic::warning(
                "missing-template",
                "Template h2.hbs is missing.",
            )],
        };

        let serialized = serde_json::to_value(&response).expect("response should serialize");

        assert_eq!(serialized["resolvedThemeId"], "default");
        assert_eq!(serialized["frontmatter"]["theme"], "default");
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
        assert_eq!(response.html, "<h1 id=\"title\">Title</h1>");
        assert_eq!(response.css.as_deref(), Some(".mh-document {}"));
        assert!(response.diagnostics.is_empty());
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
        assert_eq!(response.diagnostics[0].code, UNKNOWN_THEME);
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
