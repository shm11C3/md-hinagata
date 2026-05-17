import { randomUUID } from "node:crypto";

export interface WebviewHtmlOptions {
  bodyHtml: string;
  cspSource: string;
  nonce?: string;
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
    "</head>",
    "<body>",
    options.bodyHtml,
    "</body>",
    "</html>",
  ].join("");
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
