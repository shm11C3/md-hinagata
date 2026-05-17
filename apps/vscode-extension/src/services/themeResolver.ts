export class ThemeResolver {
  public constructor(private readonly extensionUri: string) {}

  public getBundledThemeRoot(): string {
    return `${this.extensionUri}/themes`;
  }

  public dispose(): void {}
}
