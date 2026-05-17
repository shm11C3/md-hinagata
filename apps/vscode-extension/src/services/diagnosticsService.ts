export interface DiagnosticMessage {
  message: string;
  source: "extension" | "theme" | "transform";
}

export class DiagnosticsService {
  #diagnostics: DiagnosticMessage[] = [];

  public getDiagnostics(): readonly DiagnosticMessage[] {
    return this.#diagnostics.map(cloneDiagnosticMessage);
  }

  public replaceDiagnostics(diagnostics: readonly DiagnosticMessage[]): void {
    this.#diagnostics = diagnostics.map(cloneDiagnosticMessage);
  }

  public dispose(): void {
    this.#diagnostics = [];
  }
}

function cloneDiagnosticMessage(
  diagnostic: DiagnosticMessage,
): DiagnosticMessage {
  return { ...diagnostic };
}
