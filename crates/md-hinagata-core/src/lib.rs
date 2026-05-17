pub mod diagnostics;
pub mod error;
pub mod frontmatter;
pub mod markdown;
pub mod renderer;
pub mod template;
pub mod theme;
pub mod transform;

pub use diagnostics::{Diagnostic, DiagnosticRange, DiagnosticSeverity, DiagnosticSource};
pub use error::{CoreError, Result};
pub use frontmatter::ParsedFrontmatter;
pub use theme::{ThemeManifest, ThemePackage, ThemeSource};
pub use transform::{transform, TransformOptions, TransformRequest, TransformResponse};

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
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
            themes: vec![ThemePackage {
                id: "default".to_owned(),
                name: "Default".to_owned(),
                version: "0.1.0".to_owned(),
                source: Some(ThemeSource::Bundled),
                css: Some(".mh-document {}".to_owned()),
                templates: Default::default(),
                manifest: None,
            }],
            default_theme_id: Some("default".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_theme_id, "default");
        assert_eq!(response.css.as_deref(), Some(".mh-document {}"));
        assert!(response.diagnostics.is_empty());
    }

    #[test]
    fn transform_falls_back_when_default_theme_id_is_unknown() {
        let request = TransformRequest {
            markdown: "# Title".to_owned(),
            themes: vec![
                ThemePackage {
                    id: "fallback".to_owned(),
                    name: "Fallback".to_owned(),
                    version: "0.1.0".to_owned(),
                    source: Some(ThemeSource::Bundled),
                    css: Some(".fallback {}".to_owned()),
                    templates: Default::default(),
                    manifest: None,
                },
                ThemePackage {
                    id: "other".to_owned(),
                    name: "Other".to_owned(),
                    version: "0.1.0".to_owned(),
                    source: Some(ThemeSource::Workspace),
                    css: Some(".other {}".to_owned()),
                    templates: Default::default(),
                    manifest: None,
                },
            ],
            default_theme_id: Some("missing".to_owned()),
            options: TransformOptions::default(),
        };

        let response = transform(request).expect("transform should return a response");

        assert_eq!(response.resolved_theme_id, "fallback");
        assert_eq!(response.css.as_deref(), Some(".fallback {}"));
    }
}
