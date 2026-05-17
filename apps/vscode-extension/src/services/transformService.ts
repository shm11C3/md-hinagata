export interface TransformResult {
  diagnostics: readonly string[];
  html: string;
}

export class TransformService {
  public transform(markdown: string): TransformResult {
    return {
      diagnostics: [],
      html: markdown,
    };
  }

  public dispose(): void {}
}
