export type WorkspaceTrustProvider = () => boolean;

export class WorkspaceTrustService {
  public constructor(
    private readonly workspaceTrustProvider: WorkspaceTrustProvider,
  ) {}

  public get isTrusted(): boolean {
    return this.workspaceTrustProvider();
  }

  public dispose(): void {}
}
