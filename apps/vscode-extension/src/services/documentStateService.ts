export class DocumentStateService {
  #currentTheme = "default";
  #generatedHtml = "";

  public getCurrentTheme(): string {
    return this.#currentTheme;
  }

  public setCurrentTheme(themeId: string): void {
    this.#currentTheme = themeId;
  }

  public getGeneratedHtml(): string {
    return this.#generatedHtml;
  }

  public setGeneratedHtml(html: string): void {
    this.#generatedHtml = html;
  }

  public dispose(): void {
    this.#generatedHtml = "";
  }
}
