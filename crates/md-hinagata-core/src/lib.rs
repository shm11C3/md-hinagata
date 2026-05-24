pub mod diagnostics;
pub mod error;
pub mod frontmatter;
pub mod markdown;
pub mod renderer;
pub mod template;
pub mod theme;
pub mod transform;

pub use diagnostics::{
    Diagnostic, DiagnosticRange, DiagnosticSeverity, DiagnosticSource, INVALID_FRONTMATTER,
    MISSING_TEMPLATE, TEMPLATE_RENDER_ERROR, UNKNOWN_THEME, UNSUPPORTED_CSS_MODE,
};
pub use error::{CoreError, Result};
pub use frontmatter::{parse_frontmatter, ParsedFrontmatter, ParsedMarkdown};
pub use markdown::{MarkdownBlock, MarkdownListItem};
pub use theme::{ThemeManifest, ThemePackage, ThemeSource};
pub use transform::{
    transform, CssOutputMode, TransformOptions, TransformRequest, TransformResponse,
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
