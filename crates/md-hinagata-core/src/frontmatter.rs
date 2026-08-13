use serde::{Deserialize, Serialize};

use crate::{Diagnostic, DiagnosticSource, INVALID_FRONTMATTER};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFrontmatter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub css_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_break_mode: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMarkdown {
    pub markdown: String,
    pub frontmatter: Option<ParsedFrontmatter>,
    pub diagnostics: Vec<Diagnostic>,
}

pub fn parse_frontmatter(markdown: &str) -> ParsedMarkdown {
    let Some(frontmatter_bounds) = find_frontmatter_bounds(markdown) else {
        return ParsedMarkdown {
            markdown: markdown.to_owned(),
            frontmatter: None,
            diagnostics: Vec::new(),
        };
    };

    let Ok((frontmatter, body)) = frontmatter_bounds else {
        return ParsedMarkdown {
            markdown: markdown.to_owned(),
            frontmatter: None,
            diagnostics: vec![invalid_frontmatter_diagnostic(
                "Frontmatter opening delimiter is missing a closing delimiter.",
            )],
        };
    };

    match parse_hinagata_frontmatter(frontmatter) {
        Ok(parsed) => ParsedMarkdown {
            markdown: body.to_owned(),
            frontmatter: parsed,
            diagnostics: Vec::new(),
        },
        Err(message) => ParsedMarkdown {
            markdown: body.to_owned(),
            frontmatter: None,
            diagnostics: vec![invalid_frontmatter_diagnostic(format!(
                "Frontmatter could not be parsed: {message}"
            ))],
        },
    }
}

fn parse_hinagata_frontmatter(
    frontmatter: &str,
) -> std::result::Result<Option<ParsedFrontmatter>, String> {
    let mut parsed: Option<ParsedFrontmatter> = None;
    let mut inside_hinagata = false;
    let mut child_indent: Option<usize> = None;

    for line in frontmatter.lines() {
        if indentation_contains_tab(line) {
            return Err("indentation must use spaces, not tabs".to_owned());
        }

        let indent = leading_space_count(line);
        let without_comment = strip_comment(line);
        let content = without_comment.trim();

        if content.is_empty() {
            continue;
        }

        if indent == 0 {
            inside_hinagata = false;
            child_indent = None;

            if let Some((key, value)) = split_mapping_entry(content)
                && key == "hinagata"
            {
                if parsed.is_some() {
                    return Err("hinagata namespace appears more than once".to_owned());
                }

                if !value.is_empty() {
                    return Err("hinagata must use block mapping syntax".to_owned());
                }

                parsed = Some(ParsedFrontmatter::default());
                inside_hinagata = true;
            }

            continue;
        }

        if split_mapping_entry(content).is_some_and(|(key, _value)| key == "hinagata") {
            return Err("hinagata must be a top-level frontmatter key".to_owned());
        }

        if !inside_hinagata {
            continue;
        }

        let Some((key, value)) = split_mapping_entry(content) else {
            continue;
        };

        let resolved_child_indent = match child_indent {
            Some(child_indent) => child_indent,
            None => {
                child_indent = Some(indent);
                indent
            }
        };

        if indent > resolved_child_indent {
            continue;
        }

        if indent < resolved_child_indent {
            return Err("hinagata child keys must use consistent indentation".to_owned());
        }

        if matches!(key, "theme" | "output" | "cssMode" | "lineBreakMode") {
            if value.is_empty() {
                return Err(format!("hinagata.{key} must be a string scalar"));
            }

            if value.starts_with(['[', '{']) {
                return Err(format!("hinagata.{key} must be a string scalar"));
            }

            let value = read_scalar_value(value)?;
            let frontmatter = parsed
                .as_mut()
                .expect("hinagata block should have created parsed frontmatter");

            match key {
                "theme" => set_once(&mut frontmatter.theme, value, "hinagata.theme")?,
                "output" => set_once(&mut frontmatter.output, value, "hinagata.output")?,
                "cssMode" => set_once(&mut frontmatter.css_mode, value, "hinagata.cssMode")?,
                "lineBreakMode" => set_once(
                    &mut frontmatter.line_break_mode,
                    value,
                    "hinagata.lineBreakMode",
                )?,
                _ => unreachable!("supported key should be matched"),
            }
        }
    }

    Ok(parsed)
}

fn find_frontmatter_bounds(markdown: &str) -> Option<Result<(&str, &str), ()>> {
    let content_start = if markdown.starts_with("---\n") {
        "---\n".len()
    } else if markdown.starts_with("---\r\n") {
        "---\r\n".len()
    } else {
        return None;
    };

    let content = &markdown[content_start..];
    let mut offset = 0;

    for line in content.split_inclusive('\n') {
        if line.trim_end_matches(['\r', '\n']).trim() == "---" {
            let frontmatter = &content[..offset];
            let body = &content[offset + line.len()..];
            return Some(Ok((frontmatter, body)));
        }

        offset += line.len();
    }

    if content.trim_end_matches('\r').trim_end_matches('\n').trim() == "---" {
        return Some(Ok((&content[..offset], "")));
    }

    Some(Err(()))
}

fn invalid_frontmatter_diagnostic(message: impl Into<String>) -> Diagnostic {
    Diagnostic::error(INVALID_FRONTMATTER, message).with_source(DiagnosticSource::Frontmatter)
}

fn indentation_contains_tab(line: &str) -> bool {
    line.chars()
        .take_while(|character| character.is_whitespace())
        .any(|character| character == '\t')
}

fn leading_space_count(line: &str) -> usize {
    line.chars()
        .take_while(|character| *character == ' ')
        .count()
}

fn split_mapping_entry(content: &str) -> Option<(&str, &str)> {
    let colon = content.find(':')?;
    let key = content[..colon].trim();
    let value = content[colon + 1..].trim();

    Some((key, value))
}

fn strip_comment(line: &str) -> String {
    let mut result = String::new();
    let mut in_single_quote = false;
    let mut in_double_quote = false;

    for character in line.chars() {
        match character {
            '\'' if !in_double_quote => {
                in_single_quote = !in_single_quote;
                result.push(character);
            }
            '"' if !in_single_quote => {
                in_double_quote = !in_double_quote;
                result.push(character);
            }
            '#' if !in_single_quote && !in_double_quote => break,
            _ => result.push(character),
        }
    }

    result
}

fn read_scalar_value(value: &str) -> std::result::Result<String, String> {
    let first = value
        .chars()
        .next()
        .expect("value should have first character");

    if matches!(first, '\'' | '"') {
        if value.len() < 2 || !value.ends_with(first) {
            return Err("quoted scalar must use a matching closing quote".to_owned());
        }

        let value = value[1..value.len() - 1].to_owned();

        if value.is_empty() {
            return Err("quoted scalar must not be empty".to_owned());
        }

        return Ok(value);
    }

    Ok(value.to_owned())
}

fn set_once(
    target: &mut Option<String>,
    value: String,
    name: &str,
) -> std::result::Result<(), String> {
    if target.is_some() {
        return Err(format!("{name} appears more than once"));
    }

    *target = Some(value);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_reads_output_modes() {
        let markdown = [
            "---",
            "hinagata:",
            "  theme: default",
            "  output: fragment",
            "  cssMode: separate",
            "  lineBreakMode: br",
            "---",
            "",
            "# Title",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter.theme.as_deref(), Some("default"));
        assert_eq!(frontmatter.output.as_deref(), Some("fragment"));
        assert_eq!(frontmatter.css_mode.as_deref(), Some("separate"));
        assert_eq!(frontmatter.line_break_mode.as_deref(), Some("br"));
    }

    #[test]
    fn parse_frontmatter_reads_quoted_values_without_expanding_escapes() {
        let markdown = [
            "---",
            "hinagata:",
            "  theme: \"brand\\nname\"",
            "  output: 'fragment'",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter.theme.as_deref(), Some("brand\\nname"));
        assert_eq!(frontmatter.output.as_deref(), Some("fragment"));
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn parse_frontmatter_supports_comments_outside_quotes() {
        let markdown = [
            "---",
            "# document metadata comment",
            "hinagata:",
            "  # theme comment",
            "  theme: \"brand#1\" # trailing comment",
            "  output: fragment # trailing comment",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter.theme.as_deref(), Some("brand#1"));
        assert_eq!(frontmatter.output.as_deref(), Some("fragment"));
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn parse_frontmatter_ignores_invalid_yaml_outside_hinagata() {
        let markdown = [
            "---",
            "title: [",
            "hinagata:",
            "  theme: default",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter.theme.as_deref(), Some("default"));
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn parse_frontmatter_ignores_unknown_hinagata_keys() {
        let markdown = [
            "---",
            "hinagata:",
            "  futureKey: later",
            "  theme: default",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter.theme.as_deref(), Some("default"));
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn parse_frontmatter_returns_empty_frontmatter_for_unknown_hinagata_keys() {
        let markdown = ["---", "hinagata:", "  futureKey: later", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        let frontmatter = parsed.frontmatter.expect("frontmatter should parse");

        assert_eq!(frontmatter, ParsedFrontmatter::default());
        assert!(parsed.diagnostics.is_empty());
    }

    #[test]
    fn parse_frontmatter_rejects_non_mapping_hinagata() {
        let markdown = ["---", "hinagata: { theme: default }", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_empty_supported_values() {
        let markdown = ["---", "hinagata:", "  theme:", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_empty_quoted_supported_values() {
        let markdown = ["---", "hinagata:", "  theme: \"\"", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_unclosed_quoted_supported_values() {
        let markdown = ["---", "hinagata:", "  theme: \"default", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_nested_supported_values() {
        let markdown = [
            "---",
            "hinagata:",
            "  theme:",
            "    id: default",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_duplicate_supported_keys() {
        let markdown = [
            "---",
            "hinagata:",
            "  theme: default",
            "  theme: corporate",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_duplicate_hinagata_blocks() {
        let markdown = [
            "---",
            "hinagata:",
            "  theme: default",
            "hinagata:",
            "  output: fragment",
            "---",
            "Body",
        ]
        .join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_indented_hinagata_namespace() {
        let markdown = ["---", "  hinagata:", "    theme: default", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }

    #[test]
    fn parse_frontmatter_rejects_tab_indentation() {
        let markdown = ["---", "hinagata:", "\ttheme: default", "---", "Body"].join("\n");
        let parsed = parse_frontmatter(&markdown);

        assert!(parsed.frontmatter.is_none());
        assert_eq!(parsed.diagnostics.len(), 1);
    }
}
