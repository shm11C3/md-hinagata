import {
  createActiveDocumentSnapshot,
  type DocumentStateService,
  type TextDocumentSnapshotSource,
} from "./documentStateService.js";

export interface ActiveEditorSnapshotSource {
  document: TextDocumentSnapshotSource;
}

export function updateActiveEditorState(
  documentStateService: DocumentStateService,
  editor: ActiveEditorSnapshotSource | undefined,
): void {
  if (editor === undefined) {
    return;
  }

  documentStateService.setActiveDocument(
    createActiveDocumentSnapshot(editor.document),
  );
}
