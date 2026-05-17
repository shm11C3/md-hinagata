use serde::{Deserialize, Serialize};

use crate::{Diagnostic, DiagnosticSource, INVALID_FRONTMATTER};

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFrontmatter {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedMarkdown {
    pub markdown: String,
    pub frontmatter: Option<ParsedFrontmatter>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct FrontmatterDocument {
    hinagata: Option<ParsedFrontmatter>,
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

    match serde_yaml::from_str::<FrontmatterDocument>(frontmatter) {
        Ok(parsed) => ParsedMarkdown {
            markdown: body.to_owned(),
            frontmatter: parsed.hinagata,
            diagnostics: Vec::new(),
        },
        Err(error) => ParsedMarkdown {
            markdown: body.to_owned(),
            frontmatter: None,
            diagnostics: vec![invalid_frontmatter_diagnostic(format!(
                "Frontmatter could not be parsed: {error}"
            ))],
        },
    }
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
