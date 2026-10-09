# Database Conventions (Phase 0)

- PKs: `uuid` (pgcrypto `gen_random_uuid()`), consistent naming `id`.
- Money: `Decimal(12,2)`, never float. All math in `packages/shared`.
- Time: `timestamptz` UTC in DB; display in `GYM_TIMEZONE` (default Asia/Kolkata). Membership `startDate/endDate` are `date` + documented inclusive rule.
- Auditing: `createdAt, updatedAt, createdById, updatedById` where relevant.
- Soft-delete: `archivedAt/archivedBy` for members/packages/memberships where history matters. Never hard-delete rows with finance/attendance children; block with 409 + message.
- No cascade-delete on invoices/payments/refunds/attendance. FKs `RESTRICT` there, `CASCADE` only for pure children (invoice_items, follow_ups).
- Uniqueness: `members.memberCode`, `invoices.invoiceNo`, `devices.deviceCode`, `attendance_events.dedupeKey`, `memberships.idempotencyKey`, `payments.idempotencyKey`.
- Indexes: members(phone, status, memberCode), memberships(memberId, endDate, status), invoices(memberId, issuedAt), payments(paidAt, method), attendance_events(deviceId, occurredAt, dedupeKey), follow_ups(dueAt, status).
- Migrations: versioned Prisma migrations, additive-first, no `db push`/reset on prod, backup before risky change.
- PII: minimum necessary only; no biometric templates/images in DB (only device IDs + event metadata).
