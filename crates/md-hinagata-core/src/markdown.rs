use comrak::{
    Arena, Options, format_html,
    nodes::{AstNode, ListType, NodeValue},
    parse_document,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MarkdownBlock {
    Heading {
        id: String,
        inner_html: String,
        level: u8,
        text: String,
    },
    Paragraph {
        inner_html: String,
        text: String,
    },
    CodeBlock {
        code: String,
        lang: String,
    },
    Blockquote {
        children: Vec<MarkdownBlock>,
        fallback_html: String,
    },
    List {
        ordered: bool,
        start: usize,
        items: Vec<MarkdownListItem>,
        fallback_html: String,
    },
    Html {
        html: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkdownListItem {
    pub children: Vec<MarkdownBlock>,
    pub fallback_html: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LineBreakMode {
    #[default]
    Markdown,
    Br,
    Wbr,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MarkdownOptions {
    pub allow_raw_html: bool,
    pub line_break_mode: LineBreakMode,
}

pub fn parse_markdown(markdown: &str) -> Vec<MarkdownBlock> {
    parse_markdown_with_options(markdown, MarkdownOptions::default())
}

pub fn parse_markdown_with_options(markdown: &str, options: MarkdownOptions) -> Vec<MarkdownBlock> {
    let arena = Arena::new();
    let parse_options = Options::default();
    let root = parse_document(&arena, markdown, &parse_options);

    root.children()
        .filter_map(|node| parse_block(node, options))
        .collect()
}

fn parse_block<'a>(node: &'a AstNode<'a>, options: MarkdownOptions) -> Option<MarkdownBlock> {
    match &node.data().value {
        NodeValue::Heading(heading) if (1..=3).contains(&heading.level) => {
            let text = text_content(node);
            Some(MarkdownBlock::Heading {
                id: slugify(&text),
                inner_html: inline_html(node, options, LineBreakMode::Markdown),
                level: heading.level,
                text,
            })
        }
        NodeValue::Paragraph => Some(MarkdownBlock::Paragraph {
            inner_html: inline_html(node, options, options.line_break_mode),
            text: text_content(node),
        }),
        NodeValue::CodeBlock(code_block) => Some(MarkdownBlock::CodeBlock {
            code: trim_trailing_newline(&code_block.literal).to_owned(),
            lang: code_block
                .info
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .to_owned(),
        }),
        NodeValue::BlockQuote => Some(MarkdownBlock::Blockquote {
            children: parse_child_blocks(node, options),
            fallback_html: fallback_html(node, options),
        }),
        NodeValue::List(list) => Some(MarkdownBlock::List {
            ordered: list.list_type == ListType::Ordered,
            start: list.start,
            items: node
                .children()
                .filter_map(|child| parse_list_item(child, options, list.tight))
                .collect(),
            fallback_html: fallback_html(node, options),
        }),
        NodeValue::HtmlBlock(html_block) => Some(MarkdownBlock::Html {
            html: raw_or_escaped_html(&html_block.literal, options),
        }),
        _ => {
            let html = fallback_html(node, options);
            (!html.trim().is_empty()).then_some(MarkdownBlock::Html { html })
        }
    }
}

fn parse_child_blocks<'a>(node: &'a AstNode<'a>, options: MarkdownOptions) -> Vec<MarkdownBlock> {
    node.children()
        .filter_map(|child| parse_block(child, options))
        .collect()
}

fn parse_list_item<'a>(
    node: &'a AstNode<'a>,
    options: MarkdownOptions,
    tight: bool,
) -> Option<MarkdownListItem> {
    matches!(node.data().value, NodeValue::Item(_)).then(|| MarkdownListItem {
        children: node
            .children()
            .filter_map(|child| parse_list_item_child(child, options, tight))
            .collect(),
        fallback_html: fallback_html(node, options),
    })
}

fn parse_list_item_child<'a>(
    node: &'a AstNode<'a>,
    options: MarkdownOptions,
    tight: bool,
) -> Option<MarkdownBlock> {
    if tight && matches!(node.data().value, NodeValue::Paragraph) {
        return Some(MarkdownBlock::Html {
            html: inline_html(node, options, LineBreakMode::Markdown),
        });
    }

    parse_block(node, options)
}

fn fallback_html<'a>(node: &'a AstNode<'a>, markdown_options: MarkdownOptions) -> String {
    let rewritten_soft_breaks =
        apply_line_break_mode_to_fallback(node, markdown_options.line_break_mode);

    let mut options = Options::default();
    options.render.escape = !markdown_options.allow_raw_html;

    let mut html = String::new();
    let format_result = format_html(node, &options, &mut html);
    restore_fallback_soft_breaks(rewritten_soft_breaks);

    if format_result.is_err() {
        return String::new();
    }

    html.trim_end().to_owned()
}

fn apply_line_break_mode_to_fallback<'a>(
    node: &'a AstNode<'a>,
    mode: LineBreakMode,
) -> Vec<&'a AstNode<'a>> {
    if mode == LineBreakMode::Markdown {
        return Vec::new();
    }

    let mut rewritten_soft_breaks = Vec::new();
    rewrite_fallback_paragraph_soft_breaks(node, mode, &mut rewritten_soft_breaks);
    rewritten_soft_breaks
}

fn rewrite_fallback_paragraph_soft_breaks<'a>(
    node: &'a AstNode<'a>,
    mode: LineBreakMode,
    rewritten_soft_breaks: &mut Vec<&'a AstNode<'a>>,
) {
    if matches!(node.data().value, NodeValue::Paragraph) {
        if !is_tight_list_item_paragraph(node) {
            replace_paragraph_soft_breaks(node, mode, rewritten_soft_breaks);
        }
        return;
    }

    for child in node.children() {
        rewrite_fallback_paragraph_soft_breaks(child, mode, rewritten_soft_breaks);
    }
}

fn replace_paragraph_soft_breaks<'a>(
    node: &'a AstNode<'a>,
    mode: LineBreakMode,
    rewritten_soft_breaks: &mut Vec<&'a AstNode<'a>>,
) {
    for child in node.children() {
        if matches!(child.data().value, NodeValue::SoftBreak) {
            child.data.borrow_mut().value = match mode {
                LineBreakMode::Markdown => NodeValue::SoftBreak,
                LineBreakMode::Br => NodeValue::LineBreak,
                LineBreakMode::Wbr => NodeValue::Raw("<wbr />".to_owned()),
            };
            rewritten_soft_breaks.push(child);
        } else {
            replace_paragraph_soft_breaks(child, mode, rewritten_soft_breaks);
        }
    }
}

fn restore_fallback_soft_breaks(rewritten_soft_breaks: Vec<&AstNode<'_>>) {
    for soft_break in rewritten_soft_breaks {
        soft_break.data.borrow_mut().value = NodeValue::SoftBreak;
    }
}

fn is_tight_list_item_paragraph<'a>(node: &'a AstNode<'a>) -> bool {
    let Some(item) = node.parent() else {
        return false;
    };
    if !matches!(item.data().value, NodeValue::Item(_)) {
        return false;
    }

    let Some(list) = item.parent() else {
        return false;
    };
    matches!(&list.data().value, NodeValue::List(list) if list.tight)
}

fn inline_html<'a>(
    node: &'a AstNode<'a>,
    options: MarkdownOptions,
    line_break_mode: LineBreakMode,
) -> String {
    node.children()
        .map(|child| render_inline(child, options, line_break_mode))
        .collect()
}

fn render_inline<'a>(
    node: &'a AstNode<'a>,
    options: MarkdownOptions,
    line_break_mode: LineBreakMode,
) -> String {
    match &node.data().value {
        NodeValue::Text(text) => escape_html(text),
        NodeValue::Code(code) => format!("<code>{}</code>", escape_html(&code.literal)),
        NodeValue::SoftBreak => match line_break_mode {
            LineBreakMode::Markdown => "\n".to_owned(),
            LineBreakMode::Br => "<br />\n".to_owned(),
            LineBreakMode::Wbr => "<wbr />".to_owned(),
        },
        NodeValue::LineBreak => "<br />\n".to_owned(),
        NodeValue::Emph => format!("<em>{}</em>", inline_html(node, options, line_break_mode)),
        NodeValue::Strong => format!(
            "<strong>{}</strong>",
            inline_html(node, options, line_break_mode)
        ),
        NodeValue::HtmlInline(html) => raw_or_escaped_html(html, options),
        NodeValue::Link(link) => format!(
            "<a href=\"{}\"{}>{}</a>",
            sanitized_url(&link.url),
            title_attr(&link.title),
            inline_html(node, options, line_break_mode)
        ),
        NodeValue::Image(image) => format!(
            "<img src=\"{}\" alt=\"{}\"{} />",
            sanitized_url(&image.url),
            escape_html(&text_content(node)),
            title_attr(&image.title)
        ),
        _ => inline_html(node, options, line_break_mode),
    }
}

/// Escape a link/image URL for an HTML attribute, neutralizing unsafe schemes
/// to an empty string. URL controls that browsers strip during scheme
/// resolution are removed before both validation and emission.
fn sanitized_url(url: &str) -> String {
    let normalized_url = normalize_url_for_html_attribute(url);

    if is_safe_url(&normalized_url) {
        escape_html(&normalized_url)
    } else {
        String::new()
    }
}

fn is_safe_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();

    match scheme(&lower) {
        Some("http" | "https" | "mailto" | "tel") => true,
        Some("data") => [
            "data:image/png",
            "data:image/gif",
            "data:image/jpeg",
            "data:image/webp",
        ]
        .iter()
        .any(|prefix| lower.starts_with(prefix)),
        Some(_) => false,
        None => true,
    }
}

fn normalize_url_for_html_attribute(url: &str) -> String {
    url.chars()
        .filter(|character| !matches!(character, '\t' | '\n' | '\r'))
        .skip_while(|character| is_c0_control_or_space(*character))
        .collect()
}

fn is_c0_control_or_space(character: char) -> bool {
    character <= '\u{20}'
}

fn scheme(url: &str) -> Option<&str> {
    let scheme_end = url.find(':')?;
    let before_scheme_end = &url[..scheme_end];

    if before_scheme_end.is_empty() {
        return None;
    }

    if before_scheme_end
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '+' | '-' | '.'))
        && before_scheme_end
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphabetic())
    {
        Some(before_scheme_end)
    } else {
        None
    }
}

fn title_attr(title: &str) -> String {
    if title.is_empty() {
        String::new()
    } else {
        format!(" title=\"{}\"", escape_html(title))
    }
}

fn text_content<'a>(node: &'a AstNode<'a>) -> String {
    node.children().map(inline_text).collect()
}

fn inline_text<'a>(node: &'a AstNode<'a>) -> String {
    match &node.data().value {
        NodeValue::Text(text) => text.to_string(),
        NodeValue::Code(code) => code.literal.clone(),
        NodeValue::SoftBreak | NodeValue::LineBreak => " ".to_owned(),
        _ => text_content(node),
    }
}

fn trim_trailing_newline(value: &str) -> &str {
    value
        .strip_suffix("\r\n")
        .or_else(|| value.strip_suffix('\n'))
        .unwrap_or(value)
}

fn raw_or_escaped_html(value: &str, options: MarkdownOptions) -> String {
    if options.allow_raw_html {
        value.to_owned()
    } else {
        escape_html(value)
    }
}

pub fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_separator = false;

    for character in value.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
            last_was_separator = false;
        } else if !last_was_separator && !slug.is_empty() {
            slug.push('-');
            last_was_separator = true;
        }
    }

    if last_was_separator {
        slug.pop();
    }

    if slug.is_empty() {
        "section".to_owned()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn br_mode_converts_only_paragraph_soft_breaks() {
        let blocks = parse_markdown_with_options(
            ["First", "second", "", "- item", "  continuation"]
                .join("\n")
                .as_str(),
            MarkdownOptions {
                line_break_mode: LineBreakMode::Br,
                ..MarkdownOptions::default()
            },
        );

        assert!(matches!(
            &blocks[0],
            MarkdownBlock::Paragraph { inner_html, .. }
                if inner_html == "First<br />\nsecond"
        ));
        assert!(matches!(
            &blocks[1],
            MarkdownBlock::List {
                items,
                fallback_html,
                ..
            }
                if matches!(
                    &items[0].children[0],
                    MarkdownBlock::Html { html } if html == "item\ncontinuation"
                )
                && fallback_html == "<ul>\n<li>item\ncontinuation</li>\n</ul>"
        ));
    }

    #[test]
    fn wbr_mode_keeps_explicit_hard_breaks() {
        let blocks = parse_markdown_with_options(
            ["First  ", "second", "third"].join("\n").as_str(),
            MarkdownOptions {
                line_break_mode: LineBreakMode::Wbr,
                ..MarkdownOptions::default()
            },
        );

        assert!(matches!(
            &blocks[0],
            MarkdownBlock::Paragraph { inner_html, .. }
                if inner_html == "First<br />\nsecond<wbr />third"
        ));
    }
}
