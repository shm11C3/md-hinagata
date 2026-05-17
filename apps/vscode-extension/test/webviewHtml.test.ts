import { describe, expect, it } from "vitest";

import { createWebviewHtml, escapeHtml } from "../src/utils/webviewHtml.js";

describe("webview HTML utilities", () => {
  it("escapes untrusted text for HTML fragments", () => {
    expect(escapeHtml(`<Theme id="x'&">`)).toBe(
      "&lt;Theme id=&quot;x&#39;&amp;&quot;&gt;",
    );
  });

  it("adds a strict CSP and escapes the page title", () => {
    const html = createWebviewHtml({
      bodyHtml: "<p>Trusted fragment</p>",
      cspSource: "vscode-resource:",
      nonce: "testnonce",
      stylesheets: ["vscode-resource:/preview.css"],
      title: "<Theme Manager>",
    });

    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource:; style-src vscode-resource: 'nonce-testnonce'; script-src 'nonce-testnonce';">`,
    );
    expect(html).toContain("<title>&lt;Theme Manager&gt;</title>");
    expect(html).toContain(
      '<link rel="stylesheet" href="vscode-resource:/preview.css">',
    );
    expect(html).toContain("<p>Trusted fragment</p>");
    expect(html).not.toContain("<title><Theme Manager></title>");
    expect(html).not.toContain("unsafe-inline");
  });
});
