use handlebars::Handlebars;
use serde::Serialize;

use crate::{
    Diagnostic, DiagnosticSource, MISSING_TEMPLATE, TEMPLATE_RENDER_ERROR, ThemePackage,
    markdown::escape_html,
};

pub fn render_template<T>(
    theme: &ThemePackage,
    template_key: &str,
    context: &T,
    fallback_html: String,
    diagnostics: &mut Vec<Diagnostic>,
) -> String
where
    T: Serialize,
{
    let Some(template) = theme.templates.get(template_key) else {
        diagnostics.push(
            Diagnostic::warning(
                MISSING_TEMPLATE,
                format!("Template '{template_key}' is missing."),
            )
            .with_source(DiagnosticSource::Template),
        );
        return fallback_html;
    };

    let mut handlebars = Handlebars::new();
    handlebars.register_escape_fn(escape_html);
    match handlebars.render_template(template, context) {
        Ok(html) => html,
        Err(error) => {
            diagnostics.push(
                Diagnostic::error(
                    TEMPLATE_RENDER_ERROR,
                    format!("Failed to render template '{template_key}': {error}"),
                )
                .with_source(DiagnosticSource::Template),
            );
            fallback_html
        }
    }
}
