import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  cleanMemberInput,
  diffDays,
  formatInvoiceNo,
  formatMemberCode,
  invoiceOutstanding,
  memberSchema,
  membershipValidity,
  normalizeMobile,
  packageDurationDays,
  packageSchema,
  paymentMethod,
  recomputeInvoiceStatus,
  renewalStartDate,
  toDateStrInTimezone,
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

test("invoice numbering + date helpers", () => {
  assert.equal(formatInvoiceNo(2026, 7), "INV-2026-0007");
  assert.equal(addDays("2026-01-30", 1), "2026-01-31");
  assert.equal(addDays("2026-01-01", 90), "2026-04-01");
  assert.equal(diffDays("2026-01-01", "2026-01-31"), 30);
});

test("renewal start never overlaps", () => {
  assert.equal(renewalStartDate("2026-01-30", "2026-01-15"), "2026-01-31"); // early
  assert.equal(renewalStartDate("2026-01-30", "2026-01-30"), "2026-01-31"); // on-time
  assert.equal(renewalStartDate("2026-01-30", "2026-02-10"), "2026-02-10"); // late
});

test("single validity definition", () => {
  assert.equal(membershipValidity("2026-01-01", "2026-01-30", "2026-01-15", "active"), "active");
  assert.equal(membershipValidity("2026-02-01", "2026-02-28", "2026-01-15", "active"), "scheduled");
  assert.equal(membershipValidity("2026-01-01", "2026-01-30", "2026-02-01", "active"), "expired");
  assert.equal(
    membershipValidity("2026-01-01", "2026-12-31", "2026-01-15", "suspended"),
    "suspended",
  );
  assert.equal(
    membershipValidity("2026-01-01", "2026-12-31", "2026-01-15", "cancelled"),
    "cancelled",
  );
});

test("gym-timezone dates", () => {
  // 2026-01-01T18:30Z is 2026-01-02 00:00 in Kolkata — UTC date alone would be wrong.
  assert.equal(toDateStrInTimezone(new Date("2026-01-01T18:30:00Z"), "Asia/Kolkata"), "2026-01-02");
  assert.equal(toDateStrInTimezone(new Date("2026-01-01T18:00:00Z"), "Asia/Kolkata"), "2026-01-01");
});

test("billing: methods, outstanding, status", () => {
  assert.equal(paymentMethod("upi_manual")?.needsReference, true);
  assert.equal(paymentMethod("cash")?.needsReference, false);
  assert.equal(paymentMethod("nope"), undefined);
  assert.equal(invoiceOutstanding(1168.2, 500), 668.2);
  assert.equal(invoiceOutstanding(1000, 1000), 0);
  assert.equal(recomputeInvoiceStatus(1000, 0, 0), "unpaid");
  assert.equal(recomputeInvoiceStatus(1000, 400, 0), "partial");
  assert.equal(recomputeInvoiceStatus(1000, 1000, 0), "paid");
  assert.equal(recomputeInvoiceStatus(1000, 1000, 1000), "refunded");
  assert.equal(recomputeInvoiceStatus(1000, 1000, 200), "paid");
});
