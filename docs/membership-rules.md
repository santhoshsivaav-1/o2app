# Membership Rules (Phase 0)

Single validity definition used by dashboard, profile, attendance eligibility, expiry lists, notifications, reports.

- Dates: `startDate` (date) + `durationDays` (from package: months*30 + extraDays, stored resolved) → `endDate = startDate + durationDays - 1` (**inclusive**, timezone Asia/Kolkata). Shared fn `calcEndDate`.
- Statuses: `pending_payment → active → expired`; `suspended` (pause; default: end extends by suspension days — gym to confirm); `cancelled` (terminal, reason + audit, no auto-refund; refund is separate billing flow).
- Renew: new `memberships` row linked `renewedFromId` + `renewal_events` row; never edit old row. Early renew (before end): `newStart = oldEnd + 1`. Late renew: `newStart = requestedStart`. Overlap rejected (422) unless explicit extend flow. Retried renew with same `Idempotency-Key` returns existing row (no dupes).
- Future starts allowed; `active` computed as `today in [start,end] && status==active`.
- Inactive packages blocked for new memberships (409) unless `allowLegacyRenew` flag for renewals only.
- Expiry windows: `expiring_soon = endDate in [today, today+N]` (N configurable, default 7); `expired = endDate < today && status==active` (nightly job flips to expired + notifies).
