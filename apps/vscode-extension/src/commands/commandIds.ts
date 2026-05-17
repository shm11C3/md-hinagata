export const COMMAND_IDS = {
  copyGeneratedHtml: "md-hinagata.copyGeneratedHtml",
  openThemeFile: "md-hinagata.openThemeFile",
  openPreview: "md-hinagata.openPreview",
  selectTheme: "md-hinagata.selectTheme",
} as const;

export type CommandId = (typeof COMMAND_IDS)[keyof typeof COMMAND_IDS];
