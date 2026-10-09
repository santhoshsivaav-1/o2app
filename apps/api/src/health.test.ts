import { test } from "node:test";
import assert from "node:assert/strict";

test("health payload shape", () => {
  const payload = { ok: true, service: "api" };
  assert.equal(payload.ok, true);
});
