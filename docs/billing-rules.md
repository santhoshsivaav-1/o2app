# Billing Rules — GST required (Phase 5 implemented)

Shared pure functions in `packages/shared` (`calcInvoice`, `invoiceOutstanding`, `recomputeInvoiceStatus`, `PAYMENT_METHODS`) — unit-tested, reused by API; FE uses them for preview only, API is source of truth.

- Package: `price, regFee (default 0), discountMaxPct, gstPercent (default GST_DEFAULT_PCT=18, overridable per package)`.
- GST mode: **exclusive by default**: `taxable = subtotal - discount; gst = round(taxable * pct/100); total = taxable + gst`.
- Invoice numbering: `INV-YYYY-####` per-year sequence via `SeqCounter('invoice')`, unique, issued atomically with the membership (Phase 4). Never reuse after void; corrections via credit/refund, never edit posted invoice.
- Invoice status (derived, recomputed on every payment/refund): `unpaid → partial → paid`; fully-refunded-away invoices show `refunded`. Stored for filtering, always reconcilable from allocations.
- Payments: methods `cash | upi_manual | card_manual | bank_transfer_manual | other` — ALL manually recorded, flagged `verified=false` (≠ gateway-confirmed; UPI/card/bank require a reference). Partial + multiple payments allowed; `Idempotency-Key` supported and race-safe (unique constraint decides double-submit winners, loser replays). Allocation validated: same-member invoice, `allocation ≤ outstanding`, `sum(allocations) ≤ amount`; violations → 400.
- Outstanding: **derived only**: `outstanding = total − Σ allocations`. No stored balance column. Refunds do NOT reduce outstanding — they are separate money-return events; net collected = `Σ payments − Σ refunds`.
- Overpayment: remainder becomes a `CreditAdjustment` row (member advance, visible in history; applying credits to future invoices is a later enhancement).
- Refunds: separate `refunds` row (payment FK + optional invoice FK), permission `payments.refund`, reason required, amount ≤ unrefunded balance, audited; never edit or delete the original payment.
- Rounding: half-up to 2dp at line level, then sum (documented); tests cover 0.005 boundaries.
- Reports reconcile: finance reports query invoices/payments/allocations/refunds directly, never dashboard cards. PDF via print stylesheets (free-tier honest); spreadsheets via CSV exports (`data.export`).
