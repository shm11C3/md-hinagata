export interface DiagnosticMessage {
  message: string;
  source: "extension" | "theme" | "transform";
}

export class DiagnosticsService {
  #diagnostics: DiagnosticMessage[] = [];

  public getDiagnostics(): readonly DiagnosticMessage[] {
    return this.#diagnostics;
  }

  public replaceDiagnostics(diagnostics: readonly DiagnosticMessage[]): void {
    this.#diagnostics = [...diagnostics];
  }

  public dispose(): void {
    this.#diagnostics = [];
  }
}
