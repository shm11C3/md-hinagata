export const COMMAND_IDS = {
  copyGeneratedHtml: "md-hinagata.copyGeneratedHtml",
  createThemeFromDefault: "md-hinagata.createThemeFromDefault",
  openThemeFile: "md-hinagata.openThemeFile",
  openPreview: "md-hinagata.openPreview",
  selectTheme: "md-hinagata.selectTheme",
} as const;

export type CommandId = (typeof COMMAND_IDS)[keyof typeof COMMAND_IDS];
