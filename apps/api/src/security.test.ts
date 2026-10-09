import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "./crypto.js";
import {
  csrfForSession,
  hashToken,
  newCsrfCompare,
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
} from "./tokens.js";

test("argon2id round-trip + wrong password fails", async () => {
  const hash = await hashPassword("O2-Gym-2026-99");
  assert.equal(await verifyPassword(hash, "O2-Gym-2026-99"), true);
  assert.equal(await verifyPassword(hash, "wrong-pass-00"), false);
  assert.equal(await verifyPassword("not-a-hash", "x"), false);
  assert.ok(hash.startsWith("$argon2id$"));
});

test("password policy enforced", () => {
  assert.throws(() => assertPasswordPolicy("short1"), /at least 10/);
  assert.throws(() => assertPasswordPolicy("longbutnodigits"), /letter and one number/);
  assert.doesNotThrow(() => assertPasswordPolicy("O2-Gym-2026-99"));
});

test("access/refresh sign + verify + rotation hash", () => {
  const access = signAccess("sid-1", "user-1", "a".repeat(32));
  const refresh = signRefresh("sid-1", "user-1", "b".repeat(32));
  assert.equal(verifyAccess(access, "a".repeat(32)).sid, "sid-1");
  assert.equal(verifyRefresh(refresh, "b".repeat(32)).sub, "user-1");
  assert.throws(() => verifyAccess(access, "c".repeat(32)));
  // Only the hash is stored server-side; raw token never matches the stored value.
  assert.notEqual(hashToken(refresh), refresh);
  assert.equal(hashToken(refresh), hashToken(refresh));
});

test("stateless CSRF compare is constant-shape", () => {
  const token = csrfForSession("sid-1", "s".repeat(32));
  assert.equal(newCsrfCompare(token, csrfForSession("sid-1", "s".repeat(32))), true);
  assert.equal(newCsrfCompare(token, csrfForSession("sid-2", "s".repeat(32))), false);
  assert.equal(newCsrfCompare(token, "short"), false);
});
