import path from "node:path";

import type { DocumentStateService } from "./documentStateService.js";

export interface ThemeFileDocumentSnapshot {
  uri: {
    fsPath: string;
  };
}

export type ThemeFileRefreshCallback = () => void | Promise<void>;

export class ThemeFileRefreshService {
  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly refreshActiveDocument: ThemeFileRefreshCallback,
  ) {}

  public refreshIfCurrentThemeFile(
    document: ThemeFileDocumentSnapshot,
  ): boolean {
    const state = this.documentStateService.getState();
    if (state.status !== "active") {
      return false;
    }

    const savedFilePath = normalizeFilePath(document.uri.fsPath);
    const isCurrentThemeFile = state.currentThemeFiles.some(
      (file) => normalizeFilePath(file.path) === savedFilePath,
    );
    if (!isCurrentThemeFile) {
      return false;
    }

    void this.refreshActiveDocument();
    return true;
  }
}

function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath);
}
