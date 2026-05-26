import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareVscodeExtensionPackage } from "./prepare-vscode-extension-package.mjs";

test("syncs Marketplace licenses and bundled themes into the extension package", () => {
  const temporaryRoot = mkdtempSync(
    path.join(tmpdir(), "md-hinagata-prepare-test-"),
  );

  try {
    const extensionDir = path.join(temporaryRoot, "apps", "vscode-extension");
    mkdirSync(extensionDir, { recursive: true });
    mkdirSync(path.join(temporaryRoot, "themes", "default", "templates"), {
      recursive: true,
    });
    mkdirSync(path.join(extensionDir, "themes"), { recursive: true });

    writeFileSync(path.join(temporaryRoot, "LICENSE-MIT"), "mit license\n");
    writeFileSync(
      path.join(temporaryRoot, "LICENSE-APACHE"),
      "apache license\n",
    );
    writeFileSync(
      path.join(temporaryRoot, "themes", "default", "theme.json"),
      '{"id":"default"}\n',
    );
    writeFileSync(
      path.join(temporaryRoot, "themes", "default", "templates", "p.hbs"),
      "<p>{{text}}</p>\n",
    );
    writeFileSync(
      path.join(extensionDir, "themes", "stale.txt"),
      "stale generated theme\n",
    );

    prepareVscodeExtensionPackage({
      packageExtensionDir: extensionDir,
      packageRepoRoot: temporaryRoot,
    });

    assert.equal(
      readFileSync(path.join(extensionDir, "LICENSE-MIT"), "utf8"),
      "mit license\n",
    );
    assert.equal(
      readFileSync(path.join(extensionDir, "LICENSE-APACHE"), "utf8"),
      "apache license\n",
    );
    assert.equal(
      readFileSync(
        path.join(extensionDir, "themes", "default", "theme.json"),
        "utf8",
      ),
      '{"id":"default"}\n',
    );
    assert.equal(
      readFileSync(
        path.join(extensionDir, "themes", "default", "templates", "p.hbs"),
        "utf8",
      ),
      "<p>{{text}}</p>\n",
    );
    assert.throws(() =>
      readFileSync(path.join(extensionDir, "themes", "stale.txt"), "utf8"),
    );
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
});
