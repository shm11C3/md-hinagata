export interface PreviewPanelLike {
  show(markdown: string): void | Promise<void>;
}

export async function openPreview(
  previewPanel: PreviewPanelLike,
  markdown: string,
): Promise<void> {
  await previewPanel.show(markdown);
}
