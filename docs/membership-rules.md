# Membership Rules (locked Phase 4, implemented)

Single validity definition used by dashboard, profile, attendance eligibility, expiry lists, notifications, reports — `membershipValidity()` in `packages/shared`, gym-timezone "today" (`GYM_TIMEZONE`, default Asia/Kolkata).

- Dates: `startDate` (date) + `durationDays` (from package: months*30 + extraDays, stored resolved) → `endDate = startDate + durationDays - 1` (**inclusive**). Shared fn `calcEndDate`.
- Stored statuses: `active | suspended | cancelled`. Validity is computed: `scheduled` (start in future), `active`, `expired` (end passed, still stored active), `suspended`, `cancelled`. There is deliberately no `pending_payment` membership state — payment is tracked on the invoice (Phase 5).
- Sale: member must exist and not be archived; package must be **active** (inactive → 409). Membership + invoice + items created in one Prisma transaction with an `Idempotency-Key` (replay returns the original, `idempotentReplay: true`).
- Renew: new row with `renewedFromId` + `RenewalEvent`; previous row untouched. New start = `max(requestedStart, prevEnd + 1)` — overlaps are impossible by construction. Same-package renewal allowed even if the package is now inactive (grandfathered); switching to a different inactive package → 409. Cancelled memberships cannot be renewed (409 — sell new instead).
- Discount: `discountPct` 0–100 and ≤ package `discountMaxPct` (else 400).
- Suspend: active only → `suspended` + `suspendedAt`. Resume: `active`, `endDate += whole days paused`, `suspensionDays` accumulates. Cancel: terminal, reason required, audited; no automatic refund (Phase 5 handles money separately).
- Extend: active/suspended only (expired → renew instead), `endDate += days`, audited with reason.
- Expiry windows: `expiring = endDate <= X AND status = active`; `expired = endDate < today AND status = active` (Phase 8 reminders build on these; no nightly flip needed for correctness).
