export function createWebviewHtml(title: string, body: string): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="UTF-8">',
    `<title>${title}</title>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("");
}
