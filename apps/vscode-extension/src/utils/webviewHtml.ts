import { randomUUID } from "node:crypto";

export interface WebviewHtmlOptions {
  bodyHtml: string;
  cspSource: string;
  inlineStyles?: readonly string[];
  nonce?: string;
  stylesheets?: readonly string[];
  title: string;
}

export function createWebviewHtml(options: WebviewHtmlOptions): string {
  const nonce = options.nonce ?? createNonce();
  const csp = [
    "default-src 'none'",
    `img-src ${options.cspSource}`,
    `style-src ${options.cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    `<meta http-equiv="Content-Security-Policy" content="${csp};">`,
    `<title>${escapeHtml(options.title)}</title>`,
    ...createStylesheetLinks(options.stylesheets ?? []),
    ...createInlineStyles(options.inlineStyles ?? [], nonce),
    "</head>",
    "<body>",
    options.bodyHtml,
    "</body>",
    "</html>",
  ].join("");
}

function createInlineStyles(
  styles: readonly string[],
  nonce: string,
): string[] {
  return styles.map(
    (style) =>
      `<style nonce="${escapeHtml(nonce)}">${escapeStyleText(style)}</style>`,
  );
}

function createStylesheetLinks(stylesheets: readonly string[]): string[] {
  return stylesheets.map(
    (stylesheet) => `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">`,
  );
}

function escapeStyleText(value: string): string {
  return value.replace(/<\/style/gi, "<\\/style");
}

export function createNonce(): string {
  return randomUUID().replaceAll("-", "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
