# Operations Runbook (Phase 0 skeleton — fleshed in Phase 10)

Daily: check dashboard (attendance today, collections, follow-ups due, expiring soon), review unmapped device users, retry failed jobs (`/jobs` admin view).
Weekly: overdue follow-ups, outstanding balances, backup presence check.
Monthly: restore drill on Neon branch, rotate review of device keys, audit-log spot check.
Incidents:
- API down/sleeping: hit `/health/ready`; Render dashboard restart; verify Neon connectivity; announce pilot-delay banner.
- DB migration failure: halt deploy, restore staging from dump, review migration, re-run on branch first.
- Duplicate charge complaint: search payment by idempotency key, show allocations, issue refund flow (never delete).
- Restore verification: counts + reconciliation queries in `backup-restore.md`.
Contacts/env rotation: owner holds Render+Neon+GHA secrets; rotation = update Render env → redeploy api → verify health → update GHA secrets.
