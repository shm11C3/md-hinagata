import assert from "node:assert/strict";
import test from "node:test";

import { parseRepository } from "./github-api.ts";

test("parses owner/repo repository values", () => {
  assert.deepEqual(parseRepository("shm11C3/md-hinagata"), {
    owner: "shm11C3",
    repo: "md-hinagata",
  });
});

test("rejects repository values with extra segments", () => {
  assert.throws(
    () => parseRepository("shm11C3/md-hinagata/extra"),
    /Invalid repository/,
  );
});

test("rejects repository values with empty segments", () => {
  assert.throws(() => parseRepository("shm11C3/"), /Invalid repository/);
  assert.throws(() => parseRepository("/md-hinagata"), /Invalid repository/);
});
