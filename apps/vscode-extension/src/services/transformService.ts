import { createRequire } from "node:module";
import path from "node:path";
import type * as vscode from "vscode";

export type ThemeSource = "workspace" | "bundled";
export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticSource =
  | "frontmatter"
  | "theme"
  | "template"
  | "markdown"
  | "renderer"
  | "transform";

export interface ThemeManifest {
  schemaVersion?: string;
  id: string;
  name: string;
  version: string;
  entryCss: string;
  templates: Record<string, string>;
}

export interface ThemePackage {
  id: string;
  name: string;
  version: string;
  source?: ThemeSource;
  css?: string;
  templates: Record<string, string>;
  manifest?: ThemeManifest;
}

export interface TransformOptions {
  sanitize?: boolean;
  allowRawHtml?: boolean;
}

export interface TransformRequest {
  markdown: string;
  themes: readonly ThemePackage[];
  defaultThemeId?: string;
  options?: TransformOptions;
}

export interface ParsedFrontmatter {
  theme?: string;
  output?: string;
}

export interface TransformDiagnostic {
  severity: DiagnosticSeverity;
  code?: string;
  message: string;
  source?: DiagnosticSource;
}

export interface TransformResponse {
  html: string;
  css?: string;
  resolvedThemeId: string;
  frontmatter?: ParsedFrontmatter;
  diagnostics: readonly TransformDiagnostic[];
}

export interface WasmTransformModule {
  transformMarkdownJson(
    request: TransformRequest,
  ): TransformResponse | PromiseLike<TransformResponse>;
}

export type WasmTransformModuleLoader = () => Promise<WasmTransformModule>;

export function createWasmModuleLoader(
  extensionUri: vscode.Uri,
): WasmTransformModuleLoader {
  const modulePath = path.join(
    extensionUri.fsPath,
    "wasm",
    "md_hinagata_wasm.js",
  );

  return async () => {
    const require = createRequire(import.meta.url);
    return normalizeWasmModule(require(modulePath));
  };
}

export class TransformService {
  #modulePromise: Promise<WasmTransformModule> | undefined;
  #latestResult: TransformResponse | undefined;

  public constructor(private readonly loadModule: WasmTransformModuleLoader) {}

  public getLatestResult(): TransformResponse | undefined {
    return this.#latestResult;
  }

  public async transform(markdown: string): Promise<TransformResponse>;
  public async transform(request: TransformRequest): Promise<TransformResponse>;
  public async transform(
    input: string | TransformRequest,
  ): Promise<TransformResponse> {
    const request =
      typeof input === "string" ? createDefaultRequest(input) : input;

    try {
      const wasmModule = await this.getModule();
      const response = await wasmModule.transformMarkdownJson(request);
      this.#latestResult = response;
      return response;
    } catch (error) {
      this.#modulePromise = undefined;
      const response = createErrorResponse(request, error);
      this.#latestResult = response;
      return response;
    }
  }

  public dispose(): void {
    this.#latestResult = undefined;
    this.#modulePromise = undefined;
  }

  private getModule(): Promise<WasmTransformModule> {
    this.#modulePromise ??= this.loadModule();
    return this.#modulePromise;
  }
}

function createDefaultRequest(markdown: string): TransformRequest {
  return {
    defaultThemeId: "default",
    markdown,
    options: {
      allowRawHtml: false,
    },
    themes: [],
  };
}

function createErrorResponse(
  request: TransformRequest,
  error: unknown,
): TransformResponse {
  return {
    diagnostics: [
      {
        message: getErrorMessage(error),
        severity: "error",
        source: "transform",
      },
    ],
    html: "",
    resolvedThemeId: request.defaultThemeId ?? "",
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function normalizeWasmModule(moduleValue: unknown): WasmTransformModule {
  const moduleCandidate = moduleValue as {
    default?: unknown;
    transformMarkdownJson?: unknown;
  };
  const defaultCandidate = moduleCandidate.default as
    | { transformMarkdownJson?: unknown }
    | undefined;
  const transformMarkdownJson =
    typeof moduleCandidate.transformMarkdownJson === "function"
      ? moduleCandidate.transformMarkdownJson
      : defaultCandidate?.transformMarkdownJson;

  if (typeof transformMarkdownJson !== "function") {
    throw new Error("WASM module does not export transformMarkdownJson.");
  }

  return {
    transformMarkdownJson: (request) =>
      transformMarkdownJson(request) as
        | TransformResponse
        | PromiseLike<TransformResponse>,
  };
}
