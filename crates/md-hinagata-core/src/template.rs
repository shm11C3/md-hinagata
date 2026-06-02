use serde::Serialize;
use serde_json::Value;

use crate::{
    Diagnostic, DiagnosticSource, MISSING_TEMPLATE, TEMPLATE_RENDER_ERROR, ThemePackage,
    markdown::escape_html,
};

const RAW_TEMPLATE_VALUES: &[&str] = &["inner_html"];

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

    let context = match serde_json::to_value(context) {
        Ok(context) => context,
        Err(_) => {
            diagnostics.push(render_error(
                template_key,
                "context could not be serialized".to_owned(),
            ));
            return fallback_html;
        }
    };

    match render_interpolation(template, &context) {
        Ok(html) => html,
        Err(error) => {
            diagnostics.push(render_error(template_key, error));
            fallback_html
        }
    }
}

fn render_error(template_key: &str, reason: String) -> Diagnostic {
    Diagnostic::error(
        TEMPLATE_RENDER_ERROR,
        format!("Failed to render template '{template_key}': {reason}"),
    )
    .with_source(DiagnosticSource::Template)
}

fn render_interpolation(template: &str, context: &Value) -> Result<String, String> {
    let mut output = String::with_capacity(template.len());
    let mut index = 0;

    while index < template.len() {
        let remaining = &template[index..];

        if remaining.starts_with("\\{{{") {
            output.push_str("{{{");
            index += "\\{{{".len();
            continue;
        }

        if remaining.starts_with("\\{{") {
            output.push_str("{{");
            index += "\\{{".len();
            continue;
        }

        if remaining.starts_with("{{{") {
            let token_start = index + "{{{".len();
            let Some(relative_end) = template[token_start..].find("}}}") else {
                return Err("unclosed raw interpolation".to_owned());
            };
            let token_end = token_start + relative_end;
            let value_name = parse_value_name(&template[token_start..token_end])?;
            let value = lookup_value(context, value_name)?;
            if !RAW_TEMPLATE_VALUES.contains(&value_name) {
                return Err(format!("raw insertion is not allowed for '{value_name}'."));
            }
            output.push_str(&template_value_to_string(value, value_name)?);
            index = token_end + "}}}".len();
            continue;
        }

        if remaining.starts_with("{{") {
            let token_start = index + "{{".len();
            let Some(relative_end) = template[token_start..].find("}}") else {
                return Err("unclosed escaped interpolation".to_owned());
            };
            let token_end = token_start + relative_end;
            let value_name = parse_value_name(&template[token_start..token_end])?;
            let value = lookup_value(context, value_name)?;
            output.push_str(&escape_html(&template_value_to_string(value, value_name)?));
            index = token_end + "}}".len();
            continue;
        }

        let character = remaining
            .chars()
            .next()
            .expect("index should always point at a character boundary");
        output.push(character);
        index += character.len_utf8();
    }

    Ok(output)
}

fn parse_value_name(token: &str) -> Result<&str, String> {
    let name = token.trim();

    if name.is_empty() {
        return Err("empty template value name".to_owned());
    }

    if is_identifier(name) {
        return Ok(name);
    }

    if is_unsupported_template_construct(name) {
        return Err(format!("unsupported template syntax '{name}'."));
    }

    Err(format!("invalid template value name '{name}'."))
}

fn is_identifier(name: &str) -> bool {
    let mut characters = name.chars();
    let Some(first) = characters.next() else {
        return false;
    };

    (first == '_' || first.is_ascii_alphabetic())
        && characters.all(|character| character == '_' || character.is_ascii_alphanumeric())
}

fn is_unsupported_template_construct(name: &str) -> bool {
    matches!(
        name.as_bytes().first(),
        Some(b'#' | b'/' | b'^' | b'>' | b'!' | b'&')
    )
}

fn lookup_value<'a>(context: &'a Value, value_name: &str) -> Result<&'a Value, String> {
    context
        .get(value_name)
        .ok_or_else(|| format!("unknown template value '{value_name}'."))
}

fn template_value_to_string(value: &Value, value_name: &str) -> Result<String, String> {
    match value {
        Value::String(value) => Ok(value.clone()),
        Value::Number(value) => Ok(value.to_string()),
        Value::Bool(value) => Ok(value.to_string()),
        Value::Null => Ok(String::new()),
        Value::Array(_) | Value::Object(_) => {
            Err(format!("template value '{value_name}' is not scalar."))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn renders_escaped_and_raw_insertions() {
        let context = json!({
            "text": "5 > 3 & \"ok\"",
            "inner_html": "<strong>Ready</strong>",
        });

        let html = render_interpolation("<p>{{ text }} {{{ inner_html }}}</p>", &context)
            .expect("template should render");

        assert_eq!(
            html,
            "<p>5 &gt; 3 &amp; &quot;ok&quot; <strong>Ready</strong></p>",
        );
    }

    #[test]
    fn renders_literal_interpolation_delimiters() {
        let context = json!({});

        let html = render_interpolation(r"<p>Use \{{name}} and \{{{raw}}}.</p>", &context)
            .expect("template should render");

        assert_eq!(html, "<p>Use {{name}} and {{{raw}}}.</p>");
    }

    #[test]
    fn renders_templates_without_interpolation() {
        let context = json!({});

        let html = render_interpolation("<hr class=\"section-break\" />", &context)
            .expect("literal template should render");

        assert_eq!(html, "<hr class=\"section-break\" />");
    }

    #[test]
    fn preserves_closing_delimiters_in_plain_text() {
        let context = json!({});

        let html =
            render_interpolation("<p>Plain }} and }}} text.</p>", &context).expect("plain text");

        assert_eq!(html, "<p>Plain }} and }}} text.</p>");
    }

    #[test]
    fn renders_compat_raw_value_as_escaped_insertion() {
        let context = json!({ "raw": "<script>alert('x')</script>" });

        let html = render_interpolation("<code>{{ raw }}</code>", &context)
            .expect("raw should remain available as escaped insertion");

        assert_eq!(
            html,
            "<code>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</code>",
        );
    }

    #[test]
    fn does_not_reinterpret_inserted_template_delimiters() {
        let context = json!({
            "code": "ignored",
            "inner_html": "{{code}} {{{inner_html}}}",
        });

        let html = render_interpolation("<section>{{{ inner_html }}}</section>", &context)
            .expect("inserted values should not be scanned again");

        assert_eq!(html, "<section>{{code}} {{{inner_html}}}</section>");
    }

    #[test]
    fn renders_multibyte_template_and_values() {
        let context = json!({
            "text": "こんにちは & 🧪",
            "inner_html": "<span>本文 🎌</span>",
        });

        let html = render_interpolation("<p>日本語 {{ text }} {{{ inner_html }}} 🎌</p>", &context)
            .expect("multi-byte template and values should render");

        assert_eq!(
            html,
            "<p>日本語 こんにちは &amp; 🧪 <span>本文 🎌</span> 🎌</p>",
        );
    }

    #[test]
    fn renders_scalar_values() {
        let context = json!({
            "level": 2,
            "ordered": true,
        });

        let html = render_interpolation("<p>{{level}}/{{ ordered }}</p>", &context)
            .expect("scalar values should render");

        assert_eq!(html, "<p>2/true</p>");
    }

    #[test]
    fn rejects_unknown_values() {
        let context = json!({ "text": "Body" });

        let error = render_interpolation("<p>{{titel}}</p>", &context).expect_err("should fail");

        assert_eq!(error, "unknown template value 'titel'.");
    }

    #[test]
    fn rejects_non_allowlisted_raw_insertions() {
        let context = json!({ "text": "Body" });

        let error = render_interpolation("<p>{{{ text }}}</p>", &context).expect_err("should fail");

        assert_eq!(error, "raw insertion is not allowed for 'text'.");
    }

    #[test]
    fn rejects_empty_value_names() {
        let context = json!({});

        let escaped_error =
            render_interpolation("<p>{{ }}</p>", &context).expect_err("should fail");
        let raw_error = render_interpolation("<p>{{{ }}}</p>", &context).expect_err("should fail");

        assert_eq!(escaped_error, "empty template value name");
        assert_eq!(raw_error, "empty template value name");
    }

    #[test]
    fn rejects_raw_value_as_raw_insertion() {
        let context = json!({ "raw": "<script>alert('x')</script>" });

        let error =
            render_interpolation("<code>{{{ raw }}}</code>", &context).expect_err("should fail");

        assert_eq!(error, "raw insertion is not allowed for 'raw'.");
    }

    #[test]
    fn rejects_unsupported_template_constructs() {
        let context = json!({ "text": "Body" });

        let error = render_interpolation("<p>{{#if text}}{{text}}{{/if}}</p>", &context)
            .expect_err("should fail");

        assert_eq!(error, "unsupported template syntax '#if text'.");
    }

    #[test]
    fn rejects_invalid_path_expressions() {
        let context = json!({ "foo": { "bar": "Body" } });

        let error = render_interpolation("<p>{{foo.bar}}</p>", &context).expect_err("should fail");

        assert_eq!(error, "invalid template value name 'foo.bar'.");
    }

    #[test]
    fn rejects_non_scalar_values() {
        let context = json!({
            "items": ["first"],
            "meta": { "title": "Body" },
        });

        let array_error =
            render_interpolation("<p>{{items}}</p>", &context).expect_err("should fail");
        let object_error =
            render_interpolation("<p>{{meta}}</p>", &context).expect_err("should fail");

        assert_eq!(array_error, "template value 'items' is not scalar.");
        assert_eq!(object_error, "template value 'meta' is not scalar.");
    }

    #[test]
    fn rejects_unclosed_interpolations() {
        let context = json!({ "text": "Body", "inner_html": "Body" });

        let escaped_error =
            render_interpolation("<p>{{text</p>", &context).expect_err("should fail");
        let raw_error =
            render_interpolation("<p>{{{inner_html</p>", &context).expect_err("should fail");

        assert_eq!(escaped_error, "unclosed escaped interpolation");
        assert_eq!(raw_error, "unclosed raw interpolation");
    }
}
