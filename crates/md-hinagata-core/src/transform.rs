use serde::{Deserialize, Serialize};

use crate::{
    markdown::parse_markdown, renderer::render_blocks, theme::resolve_theme, Diagnostic,
    ParsedFrontmatter, Result, ThemePackage,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter: Option<ParsedFrontmatter>,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn transform(request: TransformRequest) -> Result<TransformResponse> {
    let mut diagnostics = Vec::new();
    let theme = resolve_theme(
        &request.themes,
        None,
        request.default_theme_id.as_deref(),
        &mut diagnostics,
    );
    let resolved_theme_id = theme.map(|theme| theme.id.clone()).unwrap_or_default();
    let blocks = parse_markdown(&request.markdown);
    let html = render_blocks(&blocks, theme, &mut diagnostics);

    let css = theme.and_then(|theme| theme.css.clone());

    Ok(TransformResponse {
        html,
        css,
        resolved_theme_id,
        frontmatter: None,
        diagnostics,
    })
}
