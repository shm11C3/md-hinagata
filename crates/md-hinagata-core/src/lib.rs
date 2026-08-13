pub mod diagnostics;
pub mod error;
pub mod frontmatter;
mod inline_css;
pub mod markdown;
pub mod renderer;
pub mod template;
pub mod theme;
pub mod transform;

pub use diagnostics::{
    Diagnostic, DiagnosticRange, DiagnosticSeverity, DiagnosticSource, INVALID_FRONTMATTER,
    MISSING_TEMPLATE, TEMPLATE_RENDER_ERROR, UNKNOWN_THEME, UNSUPPORTED_CSS_MODE,
    UNSUPPORTED_INLINE_CSS, UNSUPPORTED_LINE_BREAK_MODE,
};
pub use error::{CoreError, Result};
pub use frontmatter::{ParsedFrontmatter, ParsedMarkdown, parse_frontmatter};
pub use markdown::{LineBreakMode, MarkdownBlock, MarkdownListItem};
pub use theme::{ThemeManifest, ThemePackage, ThemeSource};
pub use transform::{
    CssOutputMode, TransformOptions, TransformRequest, TransformResponse, transform,
};

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_package_version() {
        assert_eq!(version(), env!("CARGO_PKG_VERSION"));
    }
}
