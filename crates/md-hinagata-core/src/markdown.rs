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

pub fn parse_markdown(markdown: &str) -> Vec<MarkdownBlock> {
    let arena = Arena::new();
    let options = Options::default();
    let root = parse_document(&arena, markdown, &options);

    root.children().filter_map(parse_block).collect()
}

fn parse_block<'a>(node: &'a AstNode<'a>) -> Option<MarkdownBlock> {
    match &node.data().value {
        NodeValue::Heading(heading) if (1..=3).contains(&heading.level) => {
            let text = text_content(node);
            Some(MarkdownBlock::Heading {
                id: slugify(&text),
                inner_html: inline_html(node),
                level: heading.level,
                text,
            })
        }
        NodeValue::Paragraph => Some(MarkdownBlock::Paragraph {
            inner_html: inline_html(node),
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
            html: escape_html(&html_block.literal),
        }),
        _ => {
            let html = fallback_html(node);
            (!html.trim().is_empty()).then_some(MarkdownBlock::Html { html })
        }
    }
}

fn fallback_html<'a>(node: &'a AstNode<'a>) -> String {
    let mut options = Options::default();
    options.render.escape = true;

    let mut html = String::new();
    if format_html(node, &options, &mut html).is_err() {
        return String::new();
    }

    html.trim_end().to_owned()
}

fn inline_html<'a>(node: &'a AstNode<'a>) -> String {
    node.children().map(render_inline).collect()
}

fn render_inline<'a>(node: &'a AstNode<'a>) -> String {
    match &node.data().value {
        NodeValue::Text(text) => escape_html(text),
        NodeValue::Code(code) => format!("<code>{}</code>", escape_html(&code.literal)),
        NodeValue::SoftBreak => "\n".to_owned(),
        NodeValue::LineBreak => "<br />\n".to_owned(),
        NodeValue::Emph => format!("<em>{}</em>", inline_html(node)),
        NodeValue::Strong => format!("<strong>{}</strong>", inline_html(node)),
        NodeValue::HtmlInline(html) => escape_html(html),
        _ => inline_html(node),
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
