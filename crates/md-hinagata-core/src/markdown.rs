use comrak::{
    format_html,
    nodes::{AstNode, NodeValue},
    parse_document, Arena, Options,
};

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
    Html {
        html: String,
    },
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MarkdownOptions {
    pub allow_raw_html: bool,
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
                inner_html: inline_html(node, options),
                level: heading.level,
                text,
            })
        }
        NodeValue::Paragraph => Some(MarkdownBlock::Paragraph {
            inner_html: inline_html(node, options),
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
        NodeValue::HtmlBlock(html_block) => Some(MarkdownBlock::Html {
            html: raw_or_escaped_html(&html_block.literal, options),
        }),
        _ => {
            let html = fallback_html(node, options);
            (!html.trim().is_empty()).then_some(MarkdownBlock::Html { html })
        }
    }
}

fn fallback_html<'a>(node: &'a AstNode<'a>, markdown_options: MarkdownOptions) -> String {
    let mut options = Options::default();
    options.render.escape = !markdown_options.allow_raw_html;

    let mut html = String::new();
    if format_html(node, &options, &mut html).is_err() {
        return String::new();
    }

    html.trim_end().to_owned()
}

fn inline_html<'a>(node: &'a AstNode<'a>, options: MarkdownOptions) -> String {
    node.children()
        .map(|child| render_inline(child, options))
        .collect()
}

fn render_inline<'a>(node: &'a AstNode<'a>, options: MarkdownOptions) -> String {
    match &node.data().value {
        NodeValue::Text(text) => escape_html(text),
        NodeValue::Code(code) => format!("<code>{}</code>", escape_html(&code.literal)),
        NodeValue::SoftBreak => "\n".to_owned(),
        NodeValue::LineBreak => "<br />\n".to_owned(),
        NodeValue::Emph => format!("<em>{}</em>", inline_html(node, options)),
        NodeValue::Strong => format!("<strong>{}</strong>", inline_html(node, options)),
        NodeValue::HtmlInline(html) => raw_or_escaped_html(html, options),
        _ => inline_html(node, options),
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
