import type { DocumentStateService } from "../services/documentStateService.js";
import type { TransformService } from "../services/transformService.js";

export class PreviewPanel {
  #visible = false;

  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly transformService: TransformService,
  ) {}

  public get isVisible(): boolean {
    return this.#visible;
  }

  public show(): void {
    const result = this.transformService.transform("");
    this.documentStateService.setGeneratedHtml(result.html);
    this.#visible = true;
  }

  public dispose(): void {
    this.#visible = false;
  }
}
