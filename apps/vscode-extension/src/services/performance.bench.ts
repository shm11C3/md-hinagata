import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bench, describe } from "vitest";
import type * as vscode from "vscode";

import {
  PREVIEW_PANEL_TITLE,
  PreviewPanel,
  type PreviewWebviewPanel,
} from "../panels/previewPanel.js";
import { createWebviewHtml } from "../utils/webviewHtml.js";
import { DocumentStateService } from "./documentStateService.js";
import { DocumentTransformService } from "./documentTransformService.js";
import { type ThemeResolution, ThemeResolver } from "./themeResolver.js";
import type {
  ThemePackage,
  TransformRequest,
  TransformResponse,
  WasmTransformModule,
} from "./transformService.js";
import { WorkspaceTrustService } from "./workspaceTrustService.js";

const BENCHMARK_OPTIONS = {
  time: 500,
  warmupTime: 100,
};

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(serviceDirectory, "..", "..");
const repositoryRoot = path.resolve(extensionRoot, "..", "..");
const exampleWorkspaceRoot = path.join(repositoryRoot, "examples", "basic");
const bundledThemeRoot = path.join(repositoryRoot, "themes");
const sampleMarkdownPath = path.join(exampleWorkspaceRoot, "sample.md");
const transformSectionCounts = [100, 400, 1000] as const;
const inlineCssSectionCounts = [400, 1000] as const;
const previewSectionCount = 400;
const largeMarkdown = createLargeMarkdown(previewSectionCount);
const largePreviewHtml = createLargePreviewHtml(previewSectionCount);
const resolver = createFixtureThemeResolver();
const bundledOptions = { isWorkspaceTrusted: false };
const workspaceOptions = { isWorkspaceTrusted: true };
const defaultThemeResolution = await resolver.resolveTheme(
  "default",
  bundledOptions,
);
const defaultThemePackage = readResolvedThemePackage(
  defaultThemeResolution,
  "default",
);
const wasmTransformModule = loadBenchmarkWasmModule();
const largeTransformRequests = new Map<number, TransformRequest>(
  transformSectionCounts.map((sectionCount) => [
    sectionCount,
    createLargeTransformRequest(sectionCount),
  ]),
);
const inlineCssTransformRequests = new Map<number, TransformRequest>(
  inlineCssSectionCounts.map((sectionCount) => [
    sectionCount,
    createLargeTransformRequest(sectionCount, { cssMode: "inline" }),
  ]),
);
const documentStateService = new DocumentStateService();
const documentTransformService = new DocumentTransformService(
  documentStateService,
  resolver,
  {
    transform: async (request) => createBenchmarkTransformResponse(request),
  },
  new WorkspaceTrustService(() => true),
);

const sampleMarkdown = await readFile(sampleMarkdownPath, "utf8");
documentStateService.setActiveDocument({
  languageId: "markdown",
  markdown: sampleMarkdown,
  uri: `file://${sampleMarkdownPath}`,
});
await resolver.resolveTheme("basic", workspaceOptions);
await documentTransformService.refreshActiveDocument();

const previewDocumentStateService = new DocumentStateService();
const previewPanelFixture = createPreviewPanelFixture();
const previewPanel = new PreviewPanel(previewDocumentStateService, {
  createPanel: () => previewPanelFixture,
  revealPanel: (targetPanel) => {
    targetPanel.reveal();
  },
});
previewPanel.show();
previewDocumentStateService.setActiveDocument({
  languageId: "markdown",
  markdown: largeMarkdown,
  uri: "file:///large-preview-benchmark.md",
});
previewDocumentStateService.applyTransformResult({
  css: ".large-preview {}",
  diagnostics: [],
  html: largePreviewHtml,
  resolvedCssMode: "style-tag",
  resolvedThemeId: "default",
});

describe("theme resolution benchmarks", () => {
  bench(
    "resolve bundled default theme",
    async () => {
      await resolver.resolveTheme("default", bundledOptions);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "resolve workspace basic theme",
    async () => {
      await resolver.resolveTheme("basic", workspaceOptions);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    "refresh active Markdown with theme resolution",
    async () => {
      await documentTransformService.refreshActiveDocument();
    },
    BENCHMARK_OPTIONS,
  );
});

if (wasmTransformModule === undefined) {
  describe.skip("large Markdown WASM transform benchmarks", () => {
    bench("transform large Markdown through WASM", () => {});
  });
} else {
  describe("large Markdown WASM transform benchmarks", () => {
    for (const sectionCount of transformSectionCounts) {
      bench(
        `transform ${sectionCount}-section Markdown through WASM`,
        async () => {
          const response = await wasmTransformModule.transformMarkdownJson(
            readTransformRequest(largeTransformRequests, sectionCount),
          );
          consume(response.html.length);
        },
        BENCHMARK_OPTIONS,
      );
    }

    for (const sectionCount of inlineCssSectionCounts) {
      bench(
        `transform ${sectionCount}-section Markdown with cssMode inline through WASM`,
        async () => {
          const response = await wasmTransformModule.transformMarkdownJson(
            readTransformRequest(inlineCssTransformRequests, sectionCount),
          );
          consume(response.html.length);
          consume(response.diagnostics.length);
        },
        BENCHMARK_OPTIONS,
      );
    }
  });
}

describe("Preview Webview HTML regeneration benchmarks", () => {
  bench(
    `create webview HTML for ${previewSectionCount}-section generated fragment`,
    () => {
      const html = createWebviewHtml({
        allowGeneratedInlineStyles: true,
        bodyHtml: largePreviewHtml,
        cspSource: "vscode-resource:",
        title: PREVIEW_PANEL_TITLE,
      });
      consume(html.length);
    },
    BENCHMARK_OPTIONS,
  );

  bench(
    `rerender visible PreviewPanel with ${previewSectionCount}-section generated fragment`,
    () => {
      previewDocumentStateService.applyTransformResult({
        css: ".large-preview {}",
        diagnostics: [],
        html: largePreviewHtml,
        resolvedCssMode: "style-tag",
        resolvedThemeId: "default",
      });
      consume(previewPanelFixture.webview.html.length);
    },
    BENCHMARK_OPTIONS,
  );
});

function createLargeTransformRequest(
  sectionCount: number,
  options: { cssMode?: "inline" } = {},
): TransformRequest {
  return {
    defaultThemeId: "default",
    markdown: createLargeMarkdown(sectionCount, options),
    options: {
      allowRawHtml: false,
    },
    themes: [defaultThemePackage],
  };
}

function readTransformRequest(
  requests: ReadonlyMap<number, TransformRequest>,
  sectionCount: number,
): TransformRequest {
  const request = requests.get(sectionCount);
  if (request === undefined) {
    throw new Error(
      `Benchmark transform request for ${sectionCount} sections was not found.`,
    );
  }

  return request;
}

function createFixtureThemeResolver(): ThemeResolver {
  return new ThemeResolver(
    { fsPath: extensionRoot },
    {
      bundledThemeRoots: [bundledThemeRoot],
      workspaceFolders: [{ uri: { fsPath: exampleWorkspaceRoot } }],
    },
  );
}

function createBenchmarkTransformResponse(
  request: TransformRequest,
): TransformResponse {
  const resolvedThemeId = request.themes.some((theme) => theme.id === "basic")
    ? "basic"
    : "default";

  return {
    css: resolvedThemeId === "basic" ? ".basic {}" : undefined,
    diagnostics: [],
    frontmatter: {
      output: "fragment",
      theme: "basic",
    },
    html: "<h1>Benchmark</h1>",
    resolvedCssMode: "style-tag",
    resolvedThemeId,
  };
}

function readResolvedThemePackage(
  resolution: ThemeResolution,
  themeId: string,
): ThemePackage {
  const themePackage = resolution.theme?.themePackage;
  if (themePackage === undefined) {
    throw new Error(`Benchmark theme '${themeId}' could not be resolved.`);
  }

  return themePackage;
}

function loadBenchmarkWasmModule(): WasmTransformModule | undefined {
  const modulePath = path.join(extensionRoot, "wasm", "md_hinagata_wasm.js");
  if (!existsSync(modulePath)) {
    return undefined;
  }

  const require = createRequire(import.meta.url);
  return require(modulePath) as WasmTransformModule;
}

function createPreviewPanelFixture(): PreviewWebviewPanel {
  return {
    dispose: () => {},
    onDidDispose: () => ({ dispose: () => {} }),
    reveal: () => {},
    webview: {
      asWebviewUri: (_uri: vscode.Uri) =>
        ({
          toString: () => "vscode-resource:/preview/styles.css",
        }) as vscode.Uri,
      cspSource: "vscode-resource:",
      html: "",
    },
  };
}

function createLargeMarkdown(
  sectionCount: number,
  options: { cssMode?: "inline" } = {},
): string {
  const parts = ["---", "hinagata:", "  theme: default", "  output: fragment"];
  if (options.cssMode !== undefined) {
    parts.push(`  cssMode: ${options.cssMode}`);
  }
  parts.push("---", "", "# Large benchmark document");

  for (let index = 1; index <= sectionCount; index += 1) {
    parts.push(
      "",
      `## Section ${index}`,
      "",
      `Paragraph ${index} keeps **strong text**, \`inline code\`, and enough words to exercise Markdown parsing and template rendering across a larger document.`,
      "",
      "> A short quoted note that remains inside the generated fragment.",
      "",
      "- First unordered item",
      "- Second unordered item with **inline emphasis**",
      "- Third unordered item with `code`",
      "",
      "```ts",
      `const section${index} = "benchmark";`,
      `console.log(section${index});`,
      "```",
    );
  }

  return parts.join("\n");
}

function createLargePreviewHtml(sectionCount: number): string {
  const sections = ['<main class="large-preview">'];
  for (let index = 1; index <= sectionCount; index += 1) {
    sections.push(
      `<section class="large-preview-section" data-index="${index}">`,
      `<h2>Section ${index}</h2>`,
      `<p>Paragraph ${index} with <strong>strong text</strong>, <code>inline code</code>, and enough generated HTML to represent a larger preview document.</p>`,
      "<blockquote>A short quoted note that remains inside the generated fragment.</blockquote>",
      "<ul>",
      "<li>First unordered item</li>",
      "<li>Second unordered item with <strong>inline emphasis</strong></li>",
      "<li>Third unordered item with <code>code</code></li>",
      "</ul>",
      `<pre><code>const section${index} = "benchmark";\nconsole.log(section${index});</code></pre>`,
      "</section>",
    );
  }
  sections.push("</main>");

  return sections.join("");
}

let sink = 0;

function consume(value: number): void {
  sink ^= value;
  if (sink === Number.MIN_SAFE_INTEGER) {
    throw new Error("unreachable benchmark sink");
  }
}
