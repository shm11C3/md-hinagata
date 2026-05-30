import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL("./test/vscode.mock.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      exclude: ["src/**/*.bench.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "../../target/vitest-coverage/vscode-extension",
    },
  },
});
