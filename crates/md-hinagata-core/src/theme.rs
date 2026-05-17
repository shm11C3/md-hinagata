use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::{Diagnostic, DiagnosticSource, UNKNOWN_THEME};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ThemeSource {
    Workspace,
    Bundled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeManifest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema_version: Option<String>,
    pub id: String,
    pub name: String,
    pub version: String,
    pub entry_css: String,
    pub templates: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemePackage {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<ThemeSource>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css: Option<String>,
    pub templates: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<ThemeManifest>,
}

pub fn resolve_theme<'a>(
    themes: &'a [ThemePackage],
    requested_theme_id: Option<&str>,
    default_theme_id: Option<&str>,
    diagnostics: &mut Vec<Diagnostic>,
) -> Option<&'a ThemePackage> {
    if let Some(theme_id) = requested_theme_id {
        if let Some(theme) = find_theme(themes, theme_id) {
            return Some(theme);
        }

        diagnostics.push(
            Diagnostic::warning(
                UNKNOWN_THEME,
                format!("Theme '{theme_id}' was not found. Falling back to the default theme."),
            )
            .with_source(DiagnosticSource::Theme),
        );
    }

    if let Some(theme_id) = default_theme_id {
        if let Some(theme) = find_theme(themes, theme_id) {
            return Some(theme);
        }

        diagnostics.push(
            Diagnostic::warning(
                UNKNOWN_THEME,
                format!(
                    "Default theme '{theme_id}' was not found. Falling back to the first theme."
                ),
            )
            .with_source(DiagnosticSource::Theme),
        );
    }

    themes.first()
}

pub fn find_theme<'a>(themes: &'a [ThemePackage], theme_id: &str) -> Option<&'a ThemePackage> {
    themes.iter().find(|theme| theme.id == theme_id)
}
