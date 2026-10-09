import { test } from "node:test";
import assert from "node:assert/strict";
import { calcInvoice, calcEndDate, dedupeKey, membershipStatus } from "./index.js";

test("GST exclusive default 18%", () => {
  assert.deepEqual(calcInvoice({ subtotal: 1000, discount: 100 }), {
    taxable: 900,
    gst: 162,
    total: 1062,
  });
});
test("GST inclusive", () => {
  const r = calcInvoice({ subtotal: 1180, gstPercent: 18, gstInclusive: true });
  assert.equal(r.total, 1180);
  assert.equal(r.taxable, 1000);
  assert.equal(r.gst, 180);
});
test("invalid discount rejected", () => {
  assert.throws(() => calcInvoice({ subtotal: 100, discount: 200 }));
});
test("inclusive end-date", () => {
  assert.equal(calcEndDate("2026-01-01", 30), "2026-01-30");
  assert.equal(calcEndDate("2026-01-01", 1), "2026-01-01");
});
test("dedupe key + status", () => {
  assert.equal(dedupeKey("d1", "e5"), "d1:e5");
  assert.equal(membershipStatus("2026-01-01", "2026-01-30", "2026-01-15"), "active");
  assert.equal(membershipStatus("2026-01-01", "2026-01-30", "2026-02-01"), "expired");
});
