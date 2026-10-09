# Billing Rules — GST required (Phase 0)

Shared pure functions in `packages/shared/billing.ts` (unit-tested, reused by API; FE uses for preview only, API is source of truth).

- Package: `price, regFee (default 0), discountMaxPct, gstPercent (default GST_DEFAULT_PCT=18, overridable per package)`.
- GST mode: **exclusive by default** (configurable per invoice `gstInclusive=false`): `taxable = subtotal - discount; gst = round(taxable * pct/100); total = taxable + gst`.
- Invoice numbering: `INV-YYYY-####` per-year sequence (DB sequence, unique). Never reuse after void; corrections via credit/refund, never edit posted invoice.
- Payments: methods `cash | upi_manual | card_manual | other` — manual methods flagged `verified=false` (≠ gateway-confirmed). Partial + multiple allowed; each request needs `Idempotency-Key`; allocation validated `sum(allocations) <= payment.amount`; over-allocation → 422.
- Outstanding: **derived only**: `outstanding(invoice) = total - sum(allocations) + sum(refunds against it)`. No stored balance column.
- Overpayment default: create `credit_adjustments` row (consumable on next invoice); alternative refund — gym to confirm (open decision).
- Refunds: separate `refunds` row + negative allocation, permission `payments.refund`, reason required, audited, never delete payment.
- Rounding: half-up to 2dp at line level, then sum (documented); tests cover 0.005 boundaries.
- Reports reconcile: finance reports query invoices/payments/allocations/refunds directly, never dashboard cards.
