import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanMemberInput,
  formatMemberCode,
  memberSchema,
  normalizeMobile,
  packageDurationDays,
  packageSchema,
} from "./members.js";

test("mobile normalization", () => {
  assert.equal(normalizeMobile("+91 98765 43210"), "9876543210");
  assert.equal(normalizeMobile("09876543210"), "9876543210");
  assert.equal(normalizeMobile("9876543210"), "9876543210");
});

test("package durations", () => {
  assert.equal(packageDurationDays(1, "MONTH"), 30);
  assert.equal(packageDurationDays(3, "MONTH"), 90);
  assert.equal(packageDurationDays(15, "DAY"), 15);
  assert.throws(() => packageDurationDays(0, "DAY"));
});

test("member code format", () => {
  assert.equal(formatMemberCode(2026, 1), "O2-2026-0001");
  assert.equal(formatMemberCode(2026, 123), "O2-2026-0123");
});

test("member schema accepts valid input, rejects bad", () => {
  const ok = memberSchema.safeParse({
    fullName: "Asha Kumar",
    mobile: "+91 98765 43210",
    genderId: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert.equal(ok.success, true);
  assert.equal(
    memberSchema.safeParse({ fullName: "", mobile: "123", genderId: "x" }).success,
    false,
  );
  assert.equal(
    memberSchema.safeParse({
      fullName: "X",
      mobile: "9876543210",
      genderId: "123e4567-e89b-12d3-a456-426614174000",
      dob: "2099-01-01",
    }).success,
    false,
  );
});

test("package schema + clean helper", () => {
  const ok = packageSchema.safeParse({
    name: "Monthly",
    durationValue: 1,
    durationUnit: "MONTH",
    price: 1500,
  });
  assert.equal(ok.success, true);
  assert.equal(
    packageSchema.safeParse({ name: "", durationValue: 0, durationUnit: "DAY", price: -5 }).success,
    false,
  );
  assert.deepEqual(cleanMemberInput({ a: "", b: "x", confirmDuplicate: true } as never), {
    a: undefined,
    b: "x",
  });
});
