import path from "node:path";

import type { DocumentStateService } from "./documentStateService.js";

export interface ThemeFileDocumentSnapshot {
  uri: {
    fsPath: string;
  };
}

export type ThemeFileRefreshCallback = () => void | Promise<void>;
export type ThemeFileRefreshErrorHandler = (error: unknown) => void;

export class ThemeFileRefreshService {
  public constructor(
    private readonly documentStateService: DocumentStateService,
    private readonly refreshActiveDocument: ThemeFileRefreshCallback,
    private readonly handleRefreshError: ThemeFileRefreshErrorHandler = () => {},
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

    try {
      const refresh = this.refreshActiveDocument();
      if (refresh !== undefined) {
        void refresh.catch((error: unknown) => {
          this.handleRefreshError(error);
        });
      }
    } catch (error) {
      this.handleRefreshError(error);
    }
    return true;
  }
}

function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath);
}
