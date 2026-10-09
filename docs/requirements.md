# Requirements (Phase 0 snapshot of prompt.md)

Single gym, single location. No multi-branch. Roles: Owner, Manager, Receptionist, Trainer, Accountant (templates, editable permissions).

## Functional scope

- Members: register/profile/edit/history/payments/attendance/notes/archive; search (name/ID/phone), filter (status/gender/period/package/validity), server pagination, export.
- Packages: name/duration/price/regFee/discount/GST%/active flag; deactivation never destroys history.
- Memberships: create/renew/upgrade/extend/cancel/suspend; pending/active/expired/suspended/cancelled; future start dates; no duplicate members on renew; overlap rules explicit.
- Billing (GST required): invoices+items, GST exclusive default (configurable), cash/UPI/card-manual (manual ≠ gateway-confirmed), partial/multiple payments, outstanding, receipts, refunds (separate events, permission-gated), daily collection + method summaries, print/PDF/CSV/XLSX.
- Enquiries: pipeline New→Contacted→Follow-up→Trial→Interested→Converted/Lost; assign, follow-ups, overdue/upcoming, explicit audited convert (no dupes).
- Attendance: fingerprint device UNKNOWN → adapter interface + simulator (dev/test, labeled); raw vs record separation; dedupe; unmapped review; manual check-in + audited correction; device status/sync history.
- Dashboard (12 KPIs) + 17 reports, all from real SQL with documented date semantics + timezone.
- Reminders: expiry/expiring/follow-up/outstanding windows, configurable per-category on/off; in-app + dev-email only (no paid SMS/WhatsApp).
- Staff/RBAC/exports/audit; backup/restore/monitoring runbook.
- PWA installable; responsive desktop/tablet/mobile; safe offline (read-only cache, explicit queued-mutation design, offline banner).

## Non-functional

- Security: HTTPS prod, Argon2id, rate-limit auth, strict CORS, helmet headers, DTO validation, IDOR protection, secret-via-env, safe logging, upload validation.
- Data: UUIDs, Decimal money, UTC timestamps, soft-delete where history matters, no cascade-delete finance/attendance, versioned Prisma migrations, no prod resets.
- Quality gates: `pnpm lint + tsc --noEmit + jest + supertest + playwright + next build + nest build` in CI per PR.
- Deploy: Render-only Option A pilot (not always-on SLA); portable to paid/self-hosted.
