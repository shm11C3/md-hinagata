use crate::{markdown::escape_html, Diagnostic, DiagnosticSource, UNSUPPORTED_INLINE_CSS};

pub fn inline_theme_css(
    document_html: &str,
    css: Option<&str>,
    diagnostics: &mut Vec<Diagnostic>,
) -> String {
    let Some(css) = css else {
        return document_html.to_owned();
    };
    let rules = parse_inline_css_rules(css, diagnostics);
    if rules.is_empty() {
        return document_html.to_owned();
    }

    apply_inline_rules_to_html(document_html, &rules)
}

#[derive(Debug)]
struct InlineCssRule {
    selectors: Vec<Selector>,
    declarations: Vec<InlineCssDeclaration>,
}

#[derive(Debug)]
struct InlineCssDeclaration {
    property: String,
    value: String,
    important: bool,
    order: usize,
}

#[derive(Debug)]
struct Selector {
    parts: Vec<SimpleSelector>,
    specificity: Specificity,
}

#[derive(Debug)]
struct SimpleSelector {
    tag_name: Option<String>,
    id: Option<String>,
    classes: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct Specificity {
    id_count: usize,
    class_count: usize,
    type_count: usize,
}

fn parse_inline_css_rules(css: &str, diagnostics: &mut Vec<Diagnostic>) -> Vec<InlineCssRule> {
    let mut rules = Vec::new();
    let css = strip_css_comments(css);
    let mut remaining = css.as_str();
    let mut declaration_order = 0;

    loop {
        remaining = remaining.trim_start();
        if remaining.is_empty() {
            break;
        }

        if remaining.starts_with("@import") {
            diagnostics.push(unsupported_inline_css_diagnostic(
                "External CSS imports are not supported while inlining CSS.",
            ));
            let Some(import_end) = remaining.find(';') else {
                break;
            };
            remaining = &remaining[import_end + 1..];
            continue;
        }

        let Some(selector_end) = remaining.find('{') else {
            break;
        };
        let selector_text = remaining[..selector_end].trim();
        let after_selector = &remaining[selector_end + 1..];
        let Some(declarations_end) = find_css_rule_body_end(after_selector) else {
            break;
        };
        let declarations_text = &after_selector[..declarations_end];

        if selector_text.starts_with('@') {
            diagnostics.push(unsupported_inline_css_diagnostic(format!(
                "Unsupported CSS rule '{selector_text}' was skipped while inlining CSS."
            )));
            remaining = &after_selector[declarations_end + 1..];
            continue;
        }

        let mut selectors = Vec::new();
        for selector in selector_text.split(',').map(str::trim) {
            if let Some(parsed_selector) = parse_selector(selector) {
                selectors.push(parsed_selector);
            } else if !selector.is_empty() {
                diagnostics.push(unsupported_inline_css_diagnostic(format!(
                    "Unsupported CSS selector '{selector}' was skipped while inlining CSS."
                )));
            }
        }
        let declarations = parse_inline_css_declarations(
            declarations_text,
            &mut declaration_order,
            Some(diagnostics),
        );

        if !selectors.is_empty() && !declarations.is_empty() {
            rules.push(InlineCssRule {
                selectors,
                declarations,
            });
        }

        remaining = &after_selector[declarations_end + 1..];
    }

    rules
}

fn strip_css_comments(css: &str) -> String {
    let mut stripped = String::with_capacity(css.len());
    let mut characters = css.char_indices().peekable();
    let mut quote = None;
    let mut escaped = false;

    while let Some((_, character)) = characters.next() {
        if let Some(current_quote) = quote {
            stripped.push(character);
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == current_quote {
                quote = None;
            }
            continue;
        }

        match (character, characters.peek()) {
            ('"', _) | ('\'', _) => {
                quote = Some(character);
                stripped.push(character);
            }
            ('/', Some((_, '*'))) => {
                characters.next();
                while let Some((_, comment_character)) = characters.next() {
                    if comment_character == '*' {
                        if let Some((_, '/')) = characters.peek() {
                            characters.next();
                            break;
                        }
                    }
                }
            }
            _ => stripped.push(character),
        }
    }

    stripped
}

fn find_css_rule_body_end(css_after_open_brace: &str) -> Option<usize> {
    let mut quote = None;
    let mut escaped = false;
    let mut nested_brace_count = 0usize;

    for (index, character) in css_after_open_brace.char_indices() {
        if let Some(current_quote) = quote {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == current_quote {
                quote = None;
            }
            continue;
        }

        match character {
            '"' | '\'' => quote = Some(character),
            '{' => nested_brace_count += 1,
            '}' if nested_brace_count == 0 => return Some(index),
            '}' => nested_brace_count -= 1,
            _ => {}
        }
    }

    None
}

fn unsupported_inline_css_diagnostic(message: impl Into<String>) -> Diagnostic {
    Diagnostic::warning(UNSUPPORTED_INLINE_CSS, message).with_source(DiagnosticSource::Theme)
}

fn parse_inline_css_declarations(
    declarations_text: &str,
    declaration_order: &mut usize,
    mut diagnostics: Option<&mut Vec<Diagnostic>>,
) -> Vec<InlineCssDeclaration> {
    split_css_declarations(declarations_text)
        .into_iter()
        .filter_map(|declaration| {
            let (property, value) = split_css_property_value(&declaration)?;
            let property = property.trim().to_ascii_lowercase();
            let value = value.trim();
            if property.is_empty() || value.is_empty() {
                return None;
            }

            if property.starts_with("--") || value.to_ascii_lowercase().contains("var(") {
                if let Some(diagnostics) = diagnostics.as_deref_mut() {
                    diagnostics.push(unsupported_inline_css_diagnostic(format!(
                        "Unsupported CSS variable declaration '{property}' was skipped while inlining CSS."
                    )));
                    return None;
                }
            }

            let (value, important) = strip_important(value);
            let declaration = InlineCssDeclaration {
                property,
                value: value.to_owned(),
                important,
                order: *declaration_order,
            };
            *declaration_order += 1;
            Some(declaration)
        })
        .collect()
}

fn split_css_declarations(declarations_text: &str) -> Vec<String> {
    split_css_text(declarations_text, ';')
        .into_iter()
        .map(|declaration| declaration.trim().to_owned())
        .filter(|declaration| !declaration.is_empty())
        .collect()
}

fn split_css_property_value(declaration: &str) -> Option<(&str, &str)> {
    let separator_index = find_css_separator(declaration, ':')?;
    Some((
        &declaration[..separator_index],
        &declaration[separator_index + 1..],
    ))
}

fn split_css_text(text: &str, separator: char) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0;
    for index in css_separator_indices(text, separator) {
        parts.push(&text[start..index]);
        start = index + separator.len_utf8();
    }
    parts.push(&text[start..]);
    parts
}

fn find_css_separator(text: &str, separator: char) -> Option<usize> {
    css_separator_indices(text, separator).into_iter().next()
}

fn css_separator_indices(text: &str, separator: char) -> Vec<usize> {
    let mut indices = Vec::new();
    let mut quote = None;
    let mut escaped = false;
    let mut parenthesis_depth = 0usize;

    for (index, character) in text.char_indices() {
        if let Some(current_quote) = quote {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == current_quote {
                quote = None;
            }
            continue;
        }

        match character {
            '"' | '\'' => quote = Some(character),
            '(' => parenthesis_depth += 1,
            ')' if parenthesis_depth > 0 => parenthesis_depth -= 1,
            _ if character == separator && parenthesis_depth == 0 => indices.push(index),
            _ => {}
        }
    }

    indices
}

fn strip_important(value: &str) -> (&str, bool) {
    let Some(index) = value.to_ascii_lowercase().rfind("!important") else {
        return (value.trim(), false);
    };
    if !value[index + "!important".len()..].trim().is_empty() {
        return (value.trim(), false);
    }

    (value[..index].trim(), true)
}

fn apply_inline_rules_to_html(html: &str, rules: &[InlineCssRule]) -> String {
    let mut output = String::with_capacity(html.len());
    let mut element_stack = Vec::new();
    let mut cursor = 0;

    while let Some(relative_start) = html[cursor..].find('<') {
        let start = cursor + relative_start;
        let Some(end) = find_start_tag_end(html, start) else {
            break;
        };
        let start_tag = &html[start..=end];

        output.push_str(&html[cursor..start]);

        if let Some(closing_tag_name) = read_closing_tag_name(start_tag) {
            output.push_str(start_tag);
            pop_element_stack(&mut element_stack, &closing_tag_name);
        } else if read_tag_name(start_tag).is_some() {
            let style = compose_element_inline_style(start_tag, &element_stack, rules);
            if style.is_empty() {
                output.push_str(start_tag);
            } else {
                output.push_str(&insert_style_attribute(start_tag, &style));
            }

            if !is_self_closing_start_tag(start_tag) {
                element_stack.push(start_tag.to_owned());
            }
        } else {
            output.push_str(start_tag);
        }

        cursor = end + 1;
    }

    output.push_str(&html[cursor..]);
    output
}

#[derive(Debug)]
struct InlineStyleProperty {
    property: String,
    value: String,
    important: bool,
    specificity: Specificity,
    order: usize,
    source: InlineStylePropertySource,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum InlineStylePropertySource {
    ExistingStyleAttribute,
    ThemeCss,
}

fn compose_element_inline_style(
    start_tag: &str,
    element_stack: &[String],
    rules: &[InlineCssRule],
) -> String {
    let mut properties = read_attribute_value(start_tag, "style")
        .map(|style| parse_existing_style_properties(&style))
        .unwrap_or_default();

    for rule in rules {
        let Some(matching_specificity) = rule
            .selectors
            .iter()
            .filter(|selector| selector_matches_start_tag(start_tag, selector, element_stack))
            .map(|selector| selector.specificity)
            .max()
        else {
            continue;
        };

        for declaration in &rule.declarations {
            apply_inline_style_property(
                &mut properties,
                InlineStyleProperty {
                    property: declaration.property.clone(),
                    value: declaration.value.clone(),
                    important: declaration.important,
                    specificity: matching_specificity,
                    order: declaration.order,
                    source: InlineStylePropertySource::ThemeCss,
                },
            );
        }
    }

    render_inline_style_properties(&properties)
}

fn parse_existing_style_properties(style: &str) -> Vec<InlineStyleProperty> {
    let mut declaration_order = 0;
    parse_inline_css_declarations(style, &mut declaration_order, None)
        .into_iter()
        .map(|declaration| InlineStyleProperty {
            property: declaration.property,
            value: declaration.value,
            important: declaration.important,
            specificity: Specificity {
                id_count: usize::MAX,
                class_count: usize::MAX,
                type_count: usize::MAX,
            },
            order: declaration.order,
            source: InlineStylePropertySource::ExistingStyleAttribute,
        })
        .fold(Vec::new(), |mut properties, property| {
            apply_inline_style_property(&mut properties, property);
            properties
        })
}

fn apply_inline_style_property(
    properties: &mut Vec<InlineStyleProperty>,
    candidate: InlineStyleProperty,
) {
    let Some(existing) = properties
        .iter_mut()
        .find(|property| property.property == candidate.property)
    else {
        properties.push(candidate);
        return;
    };

    if should_replace_inline_style_property(existing, &candidate) {
        *existing = candidate;
    }
}

fn should_replace_inline_style_property(
    existing: &InlineStyleProperty,
    candidate: &InlineStyleProperty,
) -> bool {
    match (existing.source, candidate.source) {
        (
            InlineStylePropertySource::ExistingStyleAttribute,
            InlineStylePropertySource::ThemeCss,
        ) => {
            return false;
        }
        (
            InlineStylePropertySource::ThemeCss,
            InlineStylePropertySource::ExistingStyleAttribute,
        ) => {
            return true;
        }
        _ => {}
    }

    match candidate.important.cmp(&existing.important) {
        std::cmp::Ordering::Greater => return true,
        std::cmp::Ordering::Less => return false,
        std::cmp::Ordering::Equal => {}
    }

    match candidate.specificity.cmp(&existing.specificity) {
        std::cmp::Ordering::Greater => return true,
        std::cmp::Ordering::Less => return false,
        std::cmp::Ordering::Equal => {}
    }

    candidate.order >= existing.order
}

fn render_inline_style_properties(properties: &[InlineStyleProperty]) -> String {
    properties
        .iter()
        .map(|property| {
            let important = if property.important {
                " !important"
            } else {
                ""
            };
            format!("{}: {}{};", property.property, property.value, important)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_selector(selector: &str) -> Option<Selector> {
    let parts = selector
        .split_ascii_whitespace()
        .map(parse_simple_selector)
        .collect::<Option<Vec<_>>>()?;

    let specificity = parts.iter().fold(
        Specificity {
            id_count: 0,
            class_count: 0,
            type_count: 0,
        },
        |specificity, part| Specificity {
            id_count: specificity.id_count + usize::from(part.id.is_some()),
            class_count: specificity.class_count + part.classes.len(),
            type_count: specificity.type_count + usize::from(part.tag_name.is_some()),
        },
    );

    (!parts.is_empty()).then_some(Selector { parts, specificity })
}

fn parse_simple_selector(selector: &str) -> Option<SimpleSelector> {
    if selector.is_empty()
        || selector
            .chars()
            .any(|character| matches!(character, ':' | '[' | ']' | '>' | '+' | '~' | ',' | '*'))
    {
        return None;
    }

    let mut remaining = selector;
    let mut tag_name = None;
    let mut id = None;
    let mut classes = Vec::new();

    if !remaining.starts_with(['.', '#']) {
        let end = remaining.find(['.', '#']).unwrap_or(remaining.len());
        let tag = &remaining[..end];
        if !is_css_identifier(tag) {
            return None;
        }

        tag_name = Some(tag.to_ascii_lowercase());
        remaining = &remaining[end..];
    }

    while !remaining.is_empty() {
        let marker = remaining.as_bytes()[0] as char;
        if marker != '.' && marker != '#' {
            return None;
        }

        remaining = &remaining[1..];
        let end = remaining.find(['.', '#']).unwrap_or(remaining.len());
        let identifier = &remaining[..end];
        if !is_css_identifier(identifier) {
            return None;
        }

        match marker {
            '.' => classes.push(identifier.to_owned()),
            '#' if id.is_none() => id = Some(identifier.to_owned()),
            '#' => return None,
            _ => unreachable!("selector marker is checked above"),
        }
        remaining = &remaining[end..];
    }

    Some(SimpleSelector {
        tag_name,
        id,
        classes,
    })
}

fn is_css_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
}

fn find_start_tag_end(html: &str, start: usize) -> Option<usize> {
    let mut quote = None;
    for (offset, character) in html[start..].char_indices() {
        match (quote, character) {
            (Some(current_quote), matching_quote) if current_quote == matching_quote => {
                quote = None;
            }
            (None, '"' | '\'') => quote = Some(character),
            (None, '>') => return Some(start + offset),
            _ => {}
        }
    }

    None
}

fn start_tag_matches(start_tag: &str, selector: &SimpleSelector) -> bool {
    let Some(tag_name) = read_tag_name(start_tag) else {
        return false;
    };
    if let Some(selector_tag_name) = selector.tag_name.as_deref() {
        if tag_name != selector_tag_name {
            return false;
        }
    }

    if let Some(selector_id) = selector.id.as_deref() {
        if read_attribute_value(start_tag, "id").as_deref() != Some(selector_id) {
            return false;
        }
    }

    let element_classes = read_attribute_value(start_tag, "class").unwrap_or_default();
    selector.classes.iter().all(|selector_class| {
        element_classes
            .split_ascii_whitespace()
            .any(|element_class| element_class == selector_class)
    })
}

fn selector_matches_start_tag(
    start_tag: &str,
    selector: &Selector,
    element_stack: &[String],
) -> bool {
    let Some((target_selector, ancestor_selectors)) = selector.parts.split_last() else {
        return false;
    };
    if !start_tag_matches(start_tag, target_selector) {
        return false;
    }

    let mut next_ancestor_index = element_stack.len();
    for ancestor_selector in ancestor_selectors.iter().rev() {
        let Some(matching_index) =
            element_stack[..next_ancestor_index]
                .iter()
                .rposition(|ancestor_start_tag| {
                    start_tag_matches(ancestor_start_tag, ancestor_selector)
                })
        else {
            return false;
        };
        next_ancestor_index = matching_index;
    }

    true
}

fn read_tag_name(start_tag: &str) -> Option<String> {
    let mut characters = start_tag.strip_prefix('<')?.chars();
    let first = characters.next()?;
    if matches!(first, '/' | '!' | '?') || !first.is_ascii_alphabetic() {
        return None;
    }

    let mut tag_name = String::from(first.to_ascii_lowercase());
    for character in characters {
        if character.is_ascii_alphanumeric() || character == '-' {
            tag_name.push(character.to_ascii_lowercase());
        } else {
            break;
        }
    }

    Some(tag_name)
}

fn read_closing_tag_name(start_tag: &str) -> Option<String> {
    let mut characters = start_tag.strip_prefix("</")?.chars();
    let first = characters.next()?;
    if !first.is_ascii_alphabetic() {
        return None;
    }

    let mut tag_name = String::from(first.to_ascii_lowercase());
    for character in characters {
        if character.is_ascii_alphanumeric() || character == '-' {
            tag_name.push(character.to_ascii_lowercase());
        } else {
            break;
        }
    }

    Some(tag_name)
}

fn pop_element_stack(element_stack: &mut Vec<String>, closing_tag_name: &str) {
    let Some(index) = element_stack
        .iter()
        .rposition(|start_tag| read_tag_name(start_tag).as_deref() == Some(closing_tag_name))
    else {
        return;
    };

    element_stack.truncate(index);
}

fn read_attribute_value(start_tag: &str, attribute_name: &str) -> Option<String> {
    read_attributes(start_tag)
        .into_iter()
        .find(|attribute| attribute.name == attribute_name)
        .and_then(|attribute| attribute.value)
}

fn insert_style_attribute(start_tag: &str, style: &str) -> String {
    if let Some(style_attribute) = read_attributes(start_tag)
        .into_iter()
        .find(|attribute| attribute.name == "style")
    {
        if let Some(value_range) = style_attribute.value_range {
            return [
                &start_tag[..value_range.start],
                escape_html(style).as_str(),
                &start_tag[value_range.end..],
            ]
            .join("");
        }
    }

    let Some(mut insertion_index) = start_tag.rfind('>') else {
        return start_tag.to_owned();
    };
    if is_self_closing_start_tag(start_tag) {
        if let Some(self_closing_slash_index) = start_tag[..insertion_index].rfind('/') {
            insertion_index = self_closing_slash_index;
            while insertion_index > 0
                && start_tag.as_bytes()[insertion_index - 1].is_ascii_whitespace()
            {
                insertion_index -= 1;
            }
        }
    }
    let style_attribute = format!(" style=\"{}\"", escape_html(style));

    [
        &start_tag[..insertion_index],
        style_attribute.as_str(),
        &start_tag[insertion_index..],
    ]
    .join("")
}

fn is_self_closing_start_tag(start_tag: &str) -> bool {
    start_tag.trim_end_matches('>').trim_end().ends_with('/')
}

#[derive(Debug)]
struct HtmlAttribute {
    name: String,
    value: Option<String>,
    value_range: Option<std::ops::Range<usize>>,
}

fn read_attributes(start_tag: &str) -> Vec<HtmlAttribute> {
    let mut attributes = Vec::new();
    let Some(tag_name) = read_tag_name(start_tag) else {
        return attributes;
    };
    let Some(mut offset) = start_tag
        .find(&tag_name)
        .map(|index| index + tag_name.len())
    else {
        return attributes;
    };
    let bytes = start_tag.as_bytes();

    while offset < start_tag.len() {
        while bytes
            .get(offset)
            .is_some_and(|byte| byte.is_ascii_whitespace() || *byte == b'/')
        {
            offset += 1;
        }
        if bytes
            .get(offset)
            .is_none_or(|byte| matches!(*byte, b'>' | b'/'))
        {
            break;
        }

        let name_start = offset;
        while bytes
            .get(offset)
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'-' | b'_' | b':'))
        {
            offset += 1;
        }
        if offset == name_start {
            break;
        }

        let name = start_tag[name_start..offset].to_ascii_lowercase();
        while bytes.get(offset).is_some_and(u8::is_ascii_whitespace) {
            offset += 1;
        }

        let value = if bytes.get(offset) == Some(&b'=') {
            offset += 1;
            while bytes.get(offset).is_some_and(u8::is_ascii_whitespace) {
                offset += 1;
            }

            match bytes.get(offset) {
                Some(b'"' | b'\'') => {
                    let quote = bytes[offset];
                    offset += 1;
                    let value_start = offset;
                    while bytes.get(offset).is_some_and(|byte| *byte != quote) {
                        offset += 1;
                    }
                    let value_end = offset;
                    let value = start_tag[value_start..value_end].to_owned();
                    if bytes.get(offset) == Some(&quote) {
                        offset += 1;
                    }
                    Some((value, value_start..value_end))
                }
                Some(_) => {
                    let value_start = offset;
                    while bytes.get(offset).is_some_and(|byte| {
                        !byte.is_ascii_whitespace() && !matches!(*byte, b'>' | b'/')
                    }) {
                        offset += 1;
                    }
                    let value_end = offset;
                    Some((
                        start_tag[value_start..value_end].to_owned(),
                        value_start..value_end,
                    ))
                }
                None => None,
            }
        } else {
            None
        };

        let (value, value_range) = value
            .map(|(value, value_range)| (Some(value), Some(value_range)))
            .unwrap_or((None, None));

        attributes.push(HtmlAttribute {
            name,
            value,
            value_range,
        });
    }

    attributes
}
