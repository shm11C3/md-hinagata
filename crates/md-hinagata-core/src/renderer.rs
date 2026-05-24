use serde_json::json;

use crate::{
    Diagnostic, MarkdownBlock, ThemePackage,
    markdown::{MarkdownListItem, escape_html},
    template::render_template,
};

pub fn render_blocks(
    blocks: &[MarkdownBlock],
    theme: Option<&ThemePackage>,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    blocks
        .iter()
        .map(|block| render_block(block, theme, diagnostics))
        .map(|html| html.trim_end().to_owned())
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_block(
    block: &MarkdownBlock,
    theme: Option<&ThemePackage>,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    match block {
        MarkdownBlock::Heading {
            id,
            inner_html,
            level,
            text,
        } => {
            let key = format!("h{level}");
            let fallback = format!(
                "<h{level} id=\"{}\">{}</h{level}>",
                escape_html(id),
                inner_html
            );
            let context = json!({
                "id": id,
                "inner_html": inner_html,
                "level": level,
                "text": text,
            });
            render_with_theme(theme, &key, &context, fallback, diagnostics)
        }
        MarkdownBlock::Paragraph { inner_html, text } => {
            let fallback = format!("<p>{inner_html}</p>");
            let context = json!({
                "inner_html": inner_html,
                "text": text,
            });
            render_with_theme(theme, "p", &context, fallback, diagnostics)
        }
        MarkdownBlock::CodeBlock { code, lang } => {
            let class_attr = if lang.is_empty() {
                String::new()
            } else {
                format!(" class=\"language-{}\"", escape_html(lang))
            };
            let fallback = format!(
                "<pre><code{}>{}</code></pre>",
                class_attr,
                escape_html(code)
            );
            let context = json!({
                "code": code,
                "lang": lang,
                "raw": code,
            });
            render_with_theme(theme, "codeblock", &context, fallback, diagnostics)
        }
        MarkdownBlock::Blockquote {
            children,
            fallback_html,
        } => {
            let inner_html = render_blocks(children, theme, diagnostics);
            let context = json!({
                "inner_html": inner_html,
            });
            render_with_theme(
                theme,
                "blockquote",
                &context,
                fallback_html.clone(),
                diagnostics,
            )
        }
        MarkdownBlock::List {
            ordered,
            start,
            items,
            fallback_html,
        } => {
            let template_key = if *ordered { "ol" } else { "ul" };
            let inner_html = render_list_items(items, theme, diagnostics);
            let context = json!({
                "inner_html": inner_html,
                "ordered": *ordered,
                "start": *start,
            });
            render_with_theme(
                theme,
                template_key,
                &context,
                fallback_html.clone(),
                diagnostics,
            )
        }
        MarkdownBlock::Html { html } => html.clone(),
    }
}

fn render_list_items(
    items: &[MarkdownListItem],
    theme: Option<&ThemePackage>,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    items
        .iter()
        .map(|item| render_list_item(item, theme, diagnostics))
        .map(|html| html.trim_end().to_owned())
        .collect::<Vec<_>>()
        .join("\n")
}

fn render_list_item(
    item: &MarkdownListItem,
    theme: Option<&ThemePackage>,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    let inner_html = render_blocks(&item.children, theme, diagnostics);
    let context = json!({
        "inner_html": inner_html,
    });
    render_with_theme(
        theme,
        "li",
        &context,
        item.fallback_html.clone(),
        diagnostics,
    )
}

fn render_with_theme(
    theme: Option<&ThemePackage>,
    template_key: &str,
    context: &serde_json::Value,
    fallback_html: String,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    match theme {
        Some(theme) => render_template(theme, template_key, context, fallback_html, diagnostics),
        None => fallback_html,
    }
}
