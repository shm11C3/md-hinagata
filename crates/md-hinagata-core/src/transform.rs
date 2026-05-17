use serde::{Deserialize, Serialize};

use crate::{Diagnostic, ParsedFrontmatter, Result, ThemePackage};

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
    let resolved_theme_id = request
        .default_theme_id
        .clone()
        .or_else(|| request.themes.first().map(|theme| theme.id.clone()))
        .unwrap_or_default();

    let css = request
        .themes
        .iter()
        .find(|theme| theme.id == resolved_theme_id)
        .and_then(|theme| theme.css.clone());

    Ok(TransformResponse {
        html: String::new(),
        css,
        resolved_theme_id,
        frontmatter: None,
        diagnostics: Vec::new(),
    })
}
