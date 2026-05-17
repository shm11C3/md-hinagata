export interface PreviewPanelLike {
  show(): void | Promise<void>;
}

export async function openPreview(
  previewPanel: PreviewPanelLike,
): Promise<void> {
  await previewPanel.show();
}
